import { firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import { App } from './app';
import enJson from '../../public/i18n/en.json';
import itJson from '../../public/i18n/it.json';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App,
        TranslocoTestingModule.forRoot({
          langs: { it: itJson, en: enJson },
          translocoConfig: { availableLangs: ['it', 'en'], defaultLang: 'it', reRenderOnLangChange: true },
        }),
      ],
    }).compileComponents();
  });

  it('shows the translated title in Italian by default', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Allenamento');
  });

  it('switches title to English after setActiveLang', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const transloco = TestBed.inject(TranslocoService);
    transloco.setActiveLang('en');
    await firstValueFrom(transloco.load('en'));
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Training');
  });
});



