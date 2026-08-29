import { runMapgenWorker } from 'engine';
import { workerScope } from './workerScope';

runMapgenWorker(workerScope());
