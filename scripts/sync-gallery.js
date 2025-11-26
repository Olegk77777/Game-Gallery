const fs = require('fs');
const path = require('path');

const GALLERY_DIR = path.join(process.cwd(), 'public', 'gallery');
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

                        // Create relative path for src
                        const relativePath = path.relative(path.join(process.cwd(), 'public'), filePath);

                        game.screenshots.push({
                            id: imageId,
                            src: `/${relativePath}`,
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

try {
    console.log('Syncing gallery...');
    const games = getGames();
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(games, null, 2));
    console.log(`Synced ${games.length} games to ${OUTPUT_FILE}`);
} catch (error) {
    console.error('Error syncing gallery:', error);
    process.exit(1);
}
