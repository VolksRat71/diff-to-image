# [Git Diff to Image](https://volksrat71.github.io/diff-to-image/)

A simple React application that allows you to convert git diff output to images.

## Features

- Upload or drag and drop git diff files
- Toggle between light and dark mode
- Download the diff as an image
- Full syntax highlighting for added/removed lines

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/diff-to-image.git
cd diff-to-image
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Usage

1. Generate a git diff using one of these methods:
```bash
# Method 1: Save diff to a file
git diff > my-changes.diff

# Method 2: Diff between two commits
git diff commit1..commit2 > my-changes.diff
```

2. Upload the .diff file to the application by either:
   - Dragging and dropping the file onto the drop zone
   - Clicking the drop zone and selecting the file from your file explorer

3. Once the diff is displayed, click the "Download Image" button to save it as a PNG file.

## Technologies Used

- React with TypeScript
- Tailwind CSS for styling
- html-to-image for image generation
- Create React App as the build toolchain

## License

MIT
