/// <reference types="vitest/config" />
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    projects: [
      {
        // component tests: jsdom + browser-resolved Svelte (mount works)
        extends: true,
        plugins: [svelteTesting()],
        test: {
          name: 'client',
          environment: 'jsdom',
          clearMocks: true,
          include: ['src/**/*.svelte.{test,spec}.ts'],
          setupFiles: ['./vitest.setup.ts']
        }
      },
      {
        // logic tests: node
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['src/**/*.{test,spec}.ts'],
          exclude: ['src/**/*.svelte.{test,spec}.ts']
        }
      }
    ]
  }
});
