import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

interface PolicySection {
  TITLE: string;
  BODY: string;
}

@Component({
  selector: 'app-privacy-policy',
  imports: [ButtonModule, CardModule, RouterLink, TranslatePipe],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicyComponent {
  // 13. Public methods
  asSections(value: unknown): PolicySection[] {
    return Array.isArray(value) ? (value as PolicySection[]) : [];
  }
}
