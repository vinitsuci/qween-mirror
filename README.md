# QweenMirror

A web-based AR mirror application using Tencent AR Effect SDK.

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure credentials:**
   
   Create a `.env` file in the root directory and add your Tencent AR credentials:
   ```env
   VITE_TENCENT_APP_ID=your_app_id_here
   VITE_TENCENT_LICENSE_KEY=your_license_key_here
   VITE_TENCENT_SECRET_KEY=your_secret_key_here
   ```

   You can obtain these credentials from:
   - **App ID**: [Tencent Cloud Account Center](https://console.tencentcloud.com/developer)
   - **License Key & Token**: [Web License Management](https://console.tencentcloud.com/magic/web)

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   - Navigate to the URL shown in the terminal (usually `http://localhost:5173`)
   - Allow camera access when prompted

## Features

- Real-time AR effects using Tencent AR SDK
- Beauty filters (whitening, dermabrasion, face lift)
- Mirrored camera view
- Responsive design with modern UI

## Tech Stack

- **React 18** with TypeScript
- **Vite** for fast development
- **Tencent AR SDK** (tencentcloud-webar)
- **CryptoJS** for signature generation

## Security Note

⚠️ **Important**: This demo implements signature generation on the client-side for simplicity. In a production environment, you should:
1. Keep the `SECRET_KEY` on your backend server
2. Create a server endpoint to generate signatures
3. Call this endpoint from the frontend instead of generating signatures client-side

## Project Structure

```
qween-mirror/
├── src/
│   ├── components/
│   │   ├── QweenMirror.tsx      # Main AR component
│   │   └── QweenMirror.css      # Component styles
│   ├── utils/
│   │   └── auth.ts              # Signature generation
│   ├── App.tsx                  # Root component
│   ├── main.tsx                 # Entry point
│   └── index.css                # Global styles
├── .env                         # Credentials (not in git)
├── package.json
└── vite.config.ts
```

## Troubleshooting

- **"Please configure your Tencent AR credentials"**: Make sure your `.env` file exists and contains all three required variables
- **Camera not working**: Ensure you've granted camera permissions in your browser
- **AR effects not loading**: Check the browser console for errors and verify your credentials are correct
