# How to Add New Games and Screenshots

The gallery now updates automatically based on the files in the `public/gallery` folder. You do **NOT** need to edit any code or JSON files.

## Adding a New Screenshot

1.  **Go to the game folder**: Navigate to `public/gallery/[Game Name]/`.
2.  **Add the image**: Drop your screenshot file there (e.g., `my-screenshot.jpg`).
3.  **Add the description (Optional)**:
    *   Create a text file with the **exact same name** as the image, but with a `.txt` extension.
    *   Example: If your image is `Cyberpunk_01.jpg`, create `Cyberpunk_01.txt`.
    *   Write your annotation inside the text file.

## Adding a New Game

1.  **Create a folder**: Create a new folder in `public/gallery/` with the name of the game (e.g., `public/gallery/Elden Ring`).
2.  **Add screenshots**: Follow the steps above to add images inside this new folder.
3.  **Restart**: If the new game doesn't appear immediately, you may need to restart the dev server (`npm run dev`) or rebuild the site, as folder structures are scanned at build/runtime.

## File Formats
-   **Images**: `.jpg`, `.jpeg`, `.png`, `.webp`
-   **Text**: `.txt` (UTF-8 encoding recommended)

## Updating the Live Site

Since your site is hosted on GitHub Pages, you need to "push" your changes for them to appear online.

1.  **Make your changes**: Add or remove files in the `public/gallery` folder as described above.
2.  **Open Terminal**: Open your terminal in the project folder.
3.  **Run these commands**:
    ```bash
    git add .
    git commit -m "Update gallery"
    git push
    ```
4.  **Wait**: GitHub will automatically rebuild and deploy your site. This usually takes 1-2 minutes. You can check the progress in the "Actions" tab of your repository.
