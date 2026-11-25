# WebP Converter -- Frontend

A modern, lightweight, and responsive image-to-WebP converter built with
Next.js and TypeScript.

WebP Converter makes it easy to optimize images by converting supported
images into WebP format. It provides batch conversion, adjustable image
quality, file size comparison, and instant downloads through a clean and
intuitive interface.

Powered by a separate Cloudflare Worker backend using Cloudflare Images.

## ✨ Features

-   **Drag & Drop Upload** -- Easily upload images or browse files.
-   **Batch Conversion** -- Convert multiple images in one operation.
-   **WebP Conversion** -- Transform supported image formats into WebP.
-   **Adjustable Quality** -- Customize output quality to balance file
    size and image quality.
-   **File Size Comparison** -- Compare original and converted image
    sizes.
-   **Conversion Progress** -- Track the status of each image.
-   **Individual Downloads** -- Download converted images individually.
-   **Responsive Design** -- Optimized for desktop and mobile devices.
-   **No Sign-up Required** -- Start converting without creating an
    account.
-   **No Ads** -- Enjoy a clean conversion experience.

## 🛠️ Technology Stack

  Technology           Purpose
  -------------------- -------------------------
  Next.js              React framework
  React                UI development
  TypeScript           Type safety
  Tailwind CSS         Styling
  Lucide React         Icons
  Cloudflare Workers   Backend API integration
  Cloudflare Images    Image processing

## 🏗️ Architecture

The frontend and backend are maintained in separate repositories.

``` text
WebP Converter
│
├── Frontend (Next.js)
│   ├── Image Upload
│   ├── Image Preview
│   ├── Conversion Controls
│   ├── Progress Tracking
│   └── Image Downloads
│
└── Backend (Cloudflare Worker)
    ├── API Authentication
    ├── Request Validation
    ├── Image Processing
    └── WebP Generation
```

The frontend communicates with the Cloudflare Worker through HTTP
requests. Image processing is handled by Cloudflare Images.

## 🚀 Getting Started

### Prerequisites

-   Node.js 22 or later
-   pnpm
-   A deployed Cloudflare Worker API

### 1. Clone the repository

``` bash
git clone https://github.com/beepov/webp-converter-frontend.git
cd webp-converter-frontend
```

### 2. Install dependencies

``` bash
pnpm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

``` env
NEXT_PUBLIC_API_URL=https://your-worker-domain.workers.dev
```

Replace the URL with your deployed Cloudflare Worker endpoint.

### 4. Start the development server

``` bash
pnpm dev
```

Open <http://localhost:3000> in your browser.

## 📦 Production Build

Build the application:

``` bash
pnpm build
```

If using Next.js static export, the generated static website will be
available in the `out/` directory.

## 🔐 Security & Privacy

-   Image processing is handled by the Cloudflare Worker backend.
-   The frontend does not require a user account.
-   The conversion workflow does not intentionally store images in
    persistent image storage.
-   API authentication is handled by the backend integration.

**Security note:** Any API key included in browser-side JavaScript is
visible to users. Do not put private credentials in `NEXT_PUBLIC_`
environment variables. For private credentials, use a server-side proxy;
for a public converter, add appropriate rate limiting and abuse
protection.

## 🌐 Deployment

The frontend can be deployed using:

-   Cloudflare Pages
-   Vercel
-   Other platforms supporting Next.js static exports

Configure `NEXT_PUBLIC_API_URL` in your deployment environment before
building.

## 📄 License

Add your preferred open-source license before distributing this project.

------------------------------------------------------------------------

**WebP Converter**

Made with ♥ by **ByteLabs**.
