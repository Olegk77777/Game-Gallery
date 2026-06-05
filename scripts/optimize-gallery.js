/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

let sharp;

try {
    sharp = require("sharp");
} catch {
    console.error("Gallery optimization needs the sharp package. Run npm install, then try again.");
    process.exit(1);
}

const PUBLIC_DIR = path.join(process.cwd(), "public");
const GALLERY_DIR = path.join(PUBLIC_DIR, "gallery");
const OUTPUT_DIR = path.join(PUBLIC_DIR, "optimized-gallery");
const IMAGE_PATTERN = /\.(jpg|jpeg|png|webp)$/i;

const VARIANTS = [
    { suffix: "full", width: 2560, quality: 82 },
    { suffix: "card", width: 1400, quality: 76 },
    { suffix: "thumb", width: 360, quality: 68 },
];

function walkImages(directory) {
    if (!fs.existsSync(directory)) return [];

    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
            files.push(...walkImages(entryPath));
        } else if (IMAGE_PATTERN.test(entry.name)) {
            files.push(entryPath);
        }
    }

    return files;
}

function getOutputPath(sourcePath, suffix) {
    const relativePath = path.relative(GALLERY_DIR, sourcePath);
    const parsedPath = path.parse(relativePath);
    const outputDirectory = path.join(OUTPUT_DIR, parsedPath.dir);

    return path.join(outputDirectory, `${parsedPath.name}-${suffix}.webp`);
}

function isFresh(sourcePath, outputPaths) {
    const sourceStat = fs.statSync(sourcePath);

    return outputPaths.every((outputPath) => {
        if (!fs.existsSync(outputPath)) return false;

        const outputStat = fs.statSync(outputPath);
        return outputStat.mtimeMs >= sourceStat.mtimeMs;
    });
}

async function optimizeImage(sourcePath) {
    const outputPaths = VARIANTS.map((variant) => getOutputPath(sourcePath, variant.suffix));

    if (isFresh(sourcePath, outputPaths)) {
        return "skipped";
    }

    const image = sharp(sourcePath).rotate();

    for (const variant of VARIANTS) {
        const outputPath = getOutputPath(sourcePath, variant.suffix);

        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        await image
            .clone()
            .resize({
                width: variant.width,
                withoutEnlargement: true,
            })
            .webp({
                quality: variant.quality,
                effort: 5,
            })
            .toFile(outputPath);
    }

    return "optimized";
}

async function main() {
    const images = walkImages(GALLERY_DIR);
    let optimizedCount = 0;
    let skippedCount = 0;

    for (const imagePath of images) {
        const result = await optimizeImage(imagePath);

        if (result === "optimized") {
            optimizedCount += 1;
        } else {
            skippedCount += 1;
        }
    }

    console.log(
        `Gallery optimization complete: ${optimizedCount} optimized, ${skippedCount} already fresh.`
    );
}

main().catch((error) => {
    console.error("Error optimizing gallery:", error);
    process.exit(1);
});
