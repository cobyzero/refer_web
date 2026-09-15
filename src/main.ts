import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { appConfig } from './app/app.config';
import { App } from './app/app';

// Spanish locale data: required by DatePipe calls with explicit 'es'
// (e.g. the navbar date). Without it the pipe throws NG0701.
registerLocaleData(localeEs, 'es');

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
