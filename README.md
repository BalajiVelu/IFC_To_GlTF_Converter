# IFC to glTF Converter

A fast, privacy-focused, in-browser converter that transforms Industry Foundation Classes (IFC) files into fully hierarchical glTF (.glb) 3D models. Built with React, Three.js, and web-ifc.

## ✨ Features

- **Client-Side Processing**: Files are processed directly in your browser using WebAssembly. Your proprietary IFC models never leave your machine, ensuring complete data privacy.
- **Preserved Spatial Hierarchy**: Accurately maps the IFC spatial structure (`IfcProject` -> `IfcSite` -> `IfcBuilding` -> `IfcBuildingStorey` -> Elements) into the glTF node hierarchy.
- **Interactive 3D Preview**: Review the converted geometry and models directly in the interactive viewport before downloading.
- **Fast Export**: Quickly generate industry-standard `.glb` files ready for use in web viewers, game engines (Unity/Unreal), or AR/VR applications.

## 🛠️ Technology Stack

- **React 19** - UI Framework
- **Three.js** - 3D Rendering & glTF Exporting
- **web-ifc** - WASM-based IFC Parsing
- **Tailwind CSS** - Styling (Geometric Balance theme)
- **Vite** - Build Tooling

## 🚀 Getting Started

To run this project locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/BalajiVelu/IFC_To_GlTF_Converter.git
   cd your-repo-name
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or yarn install / pnpm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## 📦 Export Structure

The exported `.glb` files maintain a one-to-one mapping with the original IFC tree. Each node in the glTF file contains:
- The node `name` formatted as `Type [GlobalIdSnippet]`
- The exact node hierarchy translated into nested `THREE.Group` transforms.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
