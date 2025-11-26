import fs from 'fs';
import path from 'path';

export interface Screenshot {
    id: string;
    src: string;
    annotation: string;
}

export interface Game {
    title: string;
    screenshots: Screenshot[];
}

const GALLERY_DIR = path.join(process.cwd(), 'public', 'gallery');

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
            const imagePath = path.join(gamePath, imageFile);
            const relativePath = `/gallery/${gameTitle}/${imageFile}`;

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
                src: relativePath,
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

    // Sort games by title
    games.sort((a, b) => {
        if (a.title === "The Witcher 3 Wild Hunt") return -1;
        if (b.title === "The Witcher 3 Wild Hunt") return 1;
        return a.title.localeCompare(b.title);
    });

    return games;
}
