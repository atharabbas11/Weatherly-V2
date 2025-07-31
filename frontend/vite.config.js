import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

// export default {
//   server: {
//     host: '0.0.0.0',  // This allows access from any IP address on your network
//     port: 5173,       // You can specify any available port
//   },
// };
