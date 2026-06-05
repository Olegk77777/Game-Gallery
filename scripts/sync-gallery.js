/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const GALLERY_DIR = path.join(process.cwd(), 'public', 'gallery');
const HERO_GALLERY_DIR = path.join(process.cwd(), 'public', 'hero-gallery');
const OPTIMIZED_GALLERY_DIR = path.join(process.cwd(), 'public', 'optimized-gallery');
const OUTPUT_FILE = path.join(process.cwd(), 'src', 'data', 'games.json');

// Ensure gallery directory exists
if (!fs.existsSync(GALLERY_DIR)) {
    console.log('Creating gallery directory...');
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
}

function getGames() {
    const games = [];
    const items = fs.readdirSync(GALLERY_DIR);

    for (const item of items) {
        if (item.startsWith('.')) continue; // Skip hidden files

        const gamePath = path.join(GALLERY_DIR, item);
        const stats = fs.statSync(gamePath);

        if (stats.isDirectory()) {
            const game = {
                title: item,
                screenshots: []
            };

            // Recursive function to find images
            function findImages(dir) {
                const files = fs.readdirSync(dir);

                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stat = fs.statSync(filePath);

                    if (stat.isDirectory()) {
                        findImages(filePath);
                    } else if (/\.(jpg|jpeg|png|webp|gif)$/i.test(file)) {
                        const imageId = path.parse(file).name;

                        // Check for annotation text file
                        const txtPath = path.join(dir, `${imageId}.txt`);
                        let annotation = '';

                        if (fs.existsSync(txtPath)) {
                            annotation = fs.readFileSync(txtPath, 'utf-8').trim();
                        }

	                        // Create relative paths for display assets
	                        const relativePath = path.relative(path.join(process.cwd(), 'public'), filePath).split(path.sep).join('/');
                            const relativeGalleryPath = path.relative(GALLERY_DIR, filePath);
                            const originalPath = `/${relativePath}`;
                            const heroRelativeFile = relativeGalleryPath.replace(/\.(jpg|jpeg|png|webp|gif)$/i, '.jpg');
                            const heroFilePath = path.join(HERO_GALLERY_DIR, heroRelativeFile);
                            const heroRelativePath = fs.existsSync(heroFilePath)
                                ? toPublicPath(heroFilePath)
                                : originalPath;
                            const fullPath = getOptimizedPath(relativeGalleryPath, 'full') ?? originalPath;
                            const previewPath = getOptimizedPath(relativeGalleryPath, 'card') ?? heroRelativePath;
                            const thumbPath = getOptimizedPath(relativeGalleryPath, 'thumb') ?? previewPath;

	                        game.screenshots.push({
	                            id: imageId,
	                            src: fullPath,
                                previewSrc: previewPath,
                                thumbSrc: thumbPath,
                                heroSrc: heroRelativePath,
	                            annotation: annotation
	                        });
                    }
                }
            }

            findImages(gamePath);


            if (game.screenshots.length > 0) {
                games.push(game);
            }
        }
    }

    return games;
}

function toPublicPath(filePath) {
    return `/${path.relative(path.join(process.cwd(), 'public'), filePath).split(path.sep).join('/')}`;
}

function getOptimizedPath(relativeGalleryPath, variant) {
    const parsedPath = path.parse(relativeGalleryPath);
    const optimizedPath = path.join(OPTIMIZED_GALLERY_DIR, parsedPath.dir, `${parsedPath.name}-${variant}.webp`);

    return fs.existsSync(optimizedPath) ? toPublicPath(optimizedPath) : null;
}

try {
    console.log('Syncing gallery...');
    const games = getGames();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(games, null, 2));
    console.log(`Synced ${games.length} games to ${OUTPUT_FILE}`);
} catch (error) {
    console.error('Error syncing gallery:', error);
    process.exit(1);
}
