// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      requestId: string;
      user?: { id: string; username: string; isSystemAdmin: boolean };
    }
    // interface PageData {}
    // interface PageState {}
    // interface Platform {}
  }
}

export {};
