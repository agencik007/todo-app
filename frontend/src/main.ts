import { bootstrapApplication } from '@angular/platform-browser';
import 'zone.js';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { keepTooltipsInViewport } from './app/shared/utils/tooltip-viewport.util';

keepTooltipsInViewport();

bootstrapApplication(App, appConfig).catch((err) => console.error(err));
