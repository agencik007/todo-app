import { InjectionToken } from '@angular/core';

import { environment } from '../../../environments/environment';

export const API_URL = new InjectionToken<string>('API_URL', {
    providedIn: 'root',
    factory: (): string => environment.apiUrl,
});
