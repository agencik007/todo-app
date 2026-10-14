import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { NetworkStatusService } from '../../../core/services/network-status.service';
import { OfflineDataService } from '../../../core/services/offline-data.service';
import { AuthStore } from '../../../core/store/auth.store';
import { formatDateTime } from '../../utils/date.util';

/**
 * Shown while the API can't be reached: says the data is the last synced copy,
 * that todo changes wait for the connection, and how many are waiting.
 */
@Component({
  selector: 'app-offline-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './offline-banner.component.html',
  styleUrl: './offline-banner.component.scss',
})
export class OfflineBannerComponent {
  readonly #networkStatus = inject(NetworkStatusService);
  readonly #authStore = inject(AuthStore);
  readonly #offlineData = inject(OfflineDataService);

  readonly visible = computed(
    () => !this.#networkStatus.online() || this.#authStore.isOfflineSession(),
  );
  readonly hasSession = this.#authStore.hasSession;
  readonly pendingCount = computed(
    () => this.#offlineData.pendingChanges().length,
  );
  readonly lastSynced = computed(() =>
    formatDateTime(this.#offlineData.lastSyncedAt()),
  );
}
