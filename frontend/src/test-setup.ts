/**
 * Vitest global setup.
 *
 * The app loads its tables from the API at boot, so the store starts empty. Tests assert on the
 * fixture data itself, so seed the store from the JSON before each test rather than standing up a
 * backend.
 */

import { beforeEach } from 'vitest';
import { seedFixtures } from './data/testSnapshot';

// Once at import time: some suites build fixtures in a `describe` body, which runs during
// collection, before any beforeEach fires.
seedFixtures();

// And again per test, so a test that mutates the store cannot leak into the next one.
beforeEach(seedFixtures);
