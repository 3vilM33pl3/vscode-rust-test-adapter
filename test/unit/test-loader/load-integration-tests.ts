'use strict';

import { assert } from 'chai';
import { loadIntegrationTests } from '../../../src/test-loader';

// tslint:disable-next-line:max-func-body-length
export default function suite() {
    test('Should return null when no packages provided', async () => {
        const result = await loadIntegrationTests([], null);
        assert.isNull(result);
    });

    test('Should return null when null packages provided', async () => {
        const result = await loadIntegrationTests(null, null);
        assert.isNull(result);
    });
}
