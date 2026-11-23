import { DOCUMENT } from '@angular/common';
import { inject, Injectable, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { take } from 'rxjs';
import { UserApi } from '../api/user-api';
import { AuthService } from '../auth/auth.service';

export type Lang = 'it' | 'en';

const STORAGE_KEY = 'rp.lang';

function isLang(value: unknown): value is Lang {
  return value === 'it' || value === 'en';
}

function readStored(): Lang | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isLang(raw) ? raw : null;
  } catch {
    return null;
  }
}

function writeStored(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // storage non disponibile: la scelta vale solo per questa visita
  }
}

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly transloco = inject(TranslocoService);
  private readonly auth = inject(AuthService);
  private readonly userApi = inject(UserApi);
  private readonly document = inject(DOCUMENT);

  private readonly active = signal<Lang>('it');
  /** Lingua attualmente in uso. */
  readonly current = this.active.asReadonly();

  /**
   * Sceglie la lingua: profilo (se loggato) -> `rp.lang` -> navigator (`it*` -> it) -> en.
   * Applica subito la scelta locale; se c'è una sessione, il profilo la sovrascrive appena arriva.
   */
  init(): void {
    const stored = readStored();
    // il valore dedotto dal navigator non si salva: solo scelte esplicite e profilo finiscono in `rp.lang`
    this.apply(stored ?? (navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en'), false);
    if (this.auth.isLoggedIn()) {
      this.userApi.me().subscribe({
        next: (me) => {
          const lang: unknown = me.profile?.language;
          if (isLang(lang)) this.apply(lang, true);
        },
        // profilo non raggiungibile: resta la lingua locale
        error: () => undefined,
      });
    }
  }

  /** Cambia lingua; se loggato la salva anche nel profilo. */
  set(lang: Lang): void {
    this.apply(lang, true);
    if (this.auth.isLoggedIn()) {
      // best effort: la lingua locale è già applicata anche se il salvataggio fallisce
      this.userApi.update({ language: lang }).subscribe({ error: () => undefined });
    }
  }

  private apply(lang: Lang, persist: boolean): void {
    this.transloco.setActiveLang(lang);
    this.active.set(lang);
    // accessibilità: <html lang> e titolo della scheda seguono la lingua attiva
    this.document.documentElement.lang = lang;
    this.transloco
      .selectTranslate('app.title', {}, lang)
      .pipe(take(1))
      .subscribe((title) => (this.document.title = title));
    if (persist) writeStored(lang);
  }
}
