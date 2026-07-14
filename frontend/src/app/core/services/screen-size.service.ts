import { isPlatformBrowser } from '@angular/common';
import {
    inject,
    Injectable,
    OnDestroy,
    PLATFORM_ID,
    signal,
    WritableSignal,
} from '@angular/core';

@Injectable({
    providedIn: 'root',
})
export class ScreenSizeService implements OnDestroy {
    private platformId = inject(PLATFORM_ID);

    // Breakpoints consistent with our SCSS
    private readonly MOBILE_QUERY = '(max-width: 767px)';
    private readonly TABLET_QUERY =
        '(min-width: 768px) and (max-width: 1024px)';
    private readonly DESKTOP_QUERY = '(min-width: 1025px)';

    isMobile = signal(false);
    isTablet = signal(false);
    isDesktop = signal(false);
    isCompact = signal(false); // Mobile or Tablet

    private queryListeners: {
        query: MediaQueryList;
        listener: (e: MediaQueryListEvent) => void;
    }[] = [];

    constructor() {
        if (isPlatformBrowser(this.platformId)) {
            this.initQueries();
        }
    }

    private initQueries(): void {
        this.setupQuery(this.MOBILE_QUERY, this.isMobile);
        this.setupQuery(this.TABLET_QUERY, this.isTablet);
        this.setupQuery(this.DESKTOP_QUERY, this.isDesktop);

        // Initial check
        this.isMobile.set(window.matchMedia(this.MOBILE_QUERY).matches);
        this.isTablet.set(window.matchMedia(this.TABLET_QUERY).matches);
        this.isDesktop.set(window.matchMedia(this.DESKTOP_QUERY).matches);
        this.updateCompact();
    }

    private setupQuery(
        queryStr: string,
        signalToUpdate: WritableSignal<boolean>,
    ): void {
        const query = window.matchMedia(queryStr);
        const listener = (event: MediaQueryListEvent): void => {
            signalToUpdate.set(event.matches);
            this.updateCompact();
        };

        query.addEventListener('change', listener);
        this.queryListeners.push({ query, listener });
    }

    private updateCompact(): void {
        this.isCompact.set(this.isMobile() || this.isTablet());
    }

    ngOnDestroy(): void {
        this.queryListeners.forEach(({ query, listener }) => {
            query.removeEventListener('change', listener);
        });
    }
}
