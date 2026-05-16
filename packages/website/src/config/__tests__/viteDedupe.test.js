// @vitest-environment node

import config from '../../../vite.config.js';

describe('Vite dependency dedupe', () => {
  it('dedupes deck.gl and luma.gl packages used by the file-linked JBrowse plugin', () => {
    expect(config.resolve?.dedupe).toEqual(expect.arrayContaining([
      '@deck.gl/core',
      '@deck.gl/extensions',
      '@deck.gl/layers',
      '@deck.gl/react',
      '@deck.gl/widgets',
      '@luma.gl/constants',
      '@luma.gl/core',
      '@luma.gl/engine',
      '@luma.gl/shadertools',
      '@luma.gl/webgl'
    ]));
  });
});
