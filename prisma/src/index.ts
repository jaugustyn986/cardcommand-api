import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import routes from './routes';
import { connectDatabase, disconnectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(morgan(NODE_ENV === 'development' ? 'dev' : 'combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

app.use('/api', routes);
app.use(notFoundHandler);
app.use(errorHandler);

async function startServer() {
  try {
    await connectDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} in ${NODE_ENV} mode`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', async () => {
  await disconnectDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await disconnectDatabase();
  process.exit(0);
});

startServer();

export default app;
