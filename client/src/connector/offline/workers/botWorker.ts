import { runBotWorker } from 'engine';
import { workerScope } from './workerScope';

runBotWorker(workerScope());
