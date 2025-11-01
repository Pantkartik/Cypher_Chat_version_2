# 🚀 One-Click Deployment

## Backend Deployment
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template?template=https%3A%2F%2Fgithub.com%2Fyourusername%2Fcypher-chat-backend&envs=PORT&PORTDefault=3001)

## Frontend Deployment  
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fyourusername%2Fcypher-chat-frontend)

## Manual Steps (if buttons don't work)

### Backend (Railway)
1. Go to [railway.app](https://railway.app)
2. Click "New Project" → "Deploy from GitHub"
3. Add environment variable: `PORT=3001`
4. Deploy!

### Frontend (Vercel)
1. Go to [vercel.com](https://vercel.com)  
2. Click "New Project" → Import repository
3. Add environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend-url.up.railway.app
   NEXT_PUBLIC_SOCKET_URL=https://your-backend-url.up.railway.app
   ```
4. Deploy!

## 🎉 Result
- Backend: `https://your-app.up.railway.app`
- Frontend: `https://your-app.vercel.app`
- Cost: $0/month