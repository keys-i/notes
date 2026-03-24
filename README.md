# notes Documentation

[![website](https://github.com/keys-i/notes/actions/workflows/main.yml/badge.svg?cache=clear)](https://github.com/keys-i/notes/actions/workflows/main.yml)

Welcome to the documentation for notes, an online repository of resources. This repository serves as a central hub for various materials, including assignments, projects, and more. Here you'll find details on how to set up, build, and deploy the repository's resources and documentation.

## Overview

notes uses MkDocs to generate a clean, static site for organizing and displaying resources. MkDocs is a straightforward, project-focused documentation generator.

## Getting Started

### Prerequisites

Ensure you have the following installed before diving into notes:

- [Python](https://www.python.org/downloads/)
- [pip](https://pip.pypa.io/en/stable/installation/)
- [MkDocs](https://mkdocs.org/#installation) (can be installed via pip)

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/keys-i/notes.git
   cd notes
   ```

2. **Install dependencies:**

   ```bash
   python -m pip install --upgrade pip
   pip install -r requirements.txt
   ```

### Building the Resources

To build the resources and documentation locally:

1. **Run the MkDocs build command:**

   ```bash
   mkdocs build
   ```

   This will generate the static site files in the `public` directory.

2. **Preview the documentation locally:**

   ```bash
   mkdocs serve
   ```

   View the site at `http://127.0.0.1:8000/` for a live preview.

## Deployment

notes is set up for automatic deployment to GitHub Pages. Pushes to `main` and `master` build the MkDocs site and publish the generated `public/` directory through GitHub Actions.

### GitHub Actions Workflow

The GitHub Actions workflow includes steps for:

- Checking out the repository.
- Setting up Python.
- Installing the Poetry-managed dependencies.
- Building the MkDocs site from `mkdocs.yml`.
- Uploading the generated Pages artifact.
- Deploying the artifact to GitHub Pages.

GitHub Pages should be configured to use **GitHub Actions** as the build and deployment source for this workflow to publish successfully.

## Contribution

If you'd like to contribute to notes, here's how:

1. **Fork the repository.**
2. **Create a new branch:**

   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes and commit them:**

   ```bash
   git add .
   git commit -m "Describe your changes here"
   ```

4. **Push to your branch:**

   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create a pull request.**

## License

This project is licensed under the MIT License. Check out the [LICENSE](LICENSE) file for more information.

## Acknowledgments

- MkDocs: [mkdocs.org](https://mkdocs.org/)
- GitHub Pages: [GitHub Pages](https://pages.github.com/)
