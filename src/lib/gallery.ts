import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

export interface Screenshot {
    id: string;
    src: string;
    previewSrc?: string;
    thumbSrc?: string;
    heroSrc?: string;
    annotation: string;
}

export interface Game {
    title: string;
    screenshots: Screenshot[];
}

const GALLERY_DIR = path.join(process.cwd(), 'public', 'gallery');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const HERO_GALLERY_DIR = path.join(PUBLIC_DIR, 'hero-gallery');
const OPTIMIZED_GALLERY_DIR = path.join(PUBLIC_DIR, 'optimized-gallery');

function withBasePath(pathname: string) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
    return `${basePath}${pathname}`;
}

function getExistingOptimizedPath(gameTitle: string, imageFile: string, variant: string) {
    const imageName = path.parse(imageFile).name;
    const optimizedImageFile = `${imageName}-${variant}.webp`;
    const optimizedImagePath = path.join(OPTIMIZED_GALLERY_DIR, gameTitle, optimizedImageFile);

    return fs.existsSync(optimizedImagePath)
        ? withBasePath(`/optimized-gallery/${gameTitle}/${optimizedImageFile}`)
        : null;
}

export async function getGames(): Promise<Game[]> {
    // Ensure gallery directory exists
    if (!fs.existsSync(GALLERY_DIR)) {
        return [];
    }

    // Get all game directories
    const gameDirs = fs.readdirSync(GALLERY_DIR, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

    const games: Game[] = [];

    for (const gameTitle of gameDirs) {
        const gamePath = path.join(GALLERY_DIR, gameTitle);

        // Get all files in the game directory
        const files = fs.readdirSync(gamePath);

        // Filter for images
        const imageFiles = files.filter(file =>
            /\.(jpg|jpeg|png|webp)$/i.test(file)
        );

        const screenshots: Screenshot[] = [];

        for (const imageFile of imageFiles) {
            const originalPath = withBasePath(`/gallery/${gameTitle}/${imageFile}`);
            const heroImageFile = imageFile.replace(/\.(jpg|jpeg|png|webp)$/i, '.jpg');
            const heroImagePath = path.join(HERO_GALLERY_DIR, gameTitle, heroImageFile);
            const heroRelativePath = fs.existsSync(heroImagePath)
                ? withBasePath(`/hero-gallery/${gameTitle}/${heroImageFile}`)
                : originalPath;
            const fullPath = getExistingOptimizedPath(gameTitle, imageFile, 'full') ?? originalPath;
            const previewPath = getExistingOptimizedPath(gameTitle, imageFile, 'card') ?? heroRelativePath;
            const thumbPath = getExistingOptimizedPath(gameTitle, imageFile, 'thumb') ?? previewPath;

            // Check for corresponding text file
            const txtFile = imageFile.replace(/\.(jpg|jpeg|png|webp)$/i, '.txt');
            const txtPath = path.join(gamePath, txtFile);

            let annotation = "";
            if (fs.existsSync(txtPath)) {
                try {
                    annotation = fs.readFileSync(txtPath, 'utf-8').trim();
                } catch (e) {
                    console.error(`Error reading annotation for ${imageFile}:`, e);
                }
            }

	            screenshots.push({
	                id: imageFile, // Use filename as ID
	                src: fullPath,
                    previewSrc: previewPath,
                    thumbSrc: thumbPath,
                    heroSrc: heroRelativePath,
	                annotation: annotation
	            });
        }

        // Sort screenshots by name to ensure consistent order
        screenshots.sort((a, b) => a.id.localeCompare(b.id));

        if (screenshots.length > 0) {
            games.push({
                title: gameTitle,
                screenshots: screenshots
            });
        }
    }

    // Сортируем альбомы по свежести: чем недавнее обновление папки (новый альбом
    // или добавленный в него кадр), тем выше. Основной сигнал — время последнего
    // git-коммита, затронувшего папку игры (переживает сборку на CI, в отличие от
    // mtime файлов). Фолбэк по mtime — для незакоммиченных папок и окружений без git.
    const freshnessOf = (gameTitle: string): number => {
        try {
            const out = execFileSync(
                'git',
                ['log', '-1', '--format=%ct', '--', path.join('public', 'gallery', gameTitle)],
                { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] }
            ).toString().trim();
            const ts = Number.parseInt(out, 10);
            if (Number.isFinite(ts) && ts > 0) return ts;
        } catch {
            // git недоступен или папка ещё не закоммичена — переходим к mtime
        }
        try {
            let newest = 0;
            const absDir = path.join(GALLERY_DIR, gameTitle);
            for (const file of fs.readdirSync(absDir)) {
                const m = fs.statSync(path.join(absDir, file)).mtimeMs / 1000;
                if (m > newest) newest = m;
            }
            return newest;
        } catch {
            return 0;
        }
    };

    const freshness = new Map(games.map((game) => [game.title, freshnessOf(game.title)]));
    games.sort((a, b) => (freshness.get(b.title) ?? 0) - (freshness.get(a.title) ?? 0));

    return games;
}
