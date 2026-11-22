import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { LanguageService } from './core/i18n/language.service';

describe('App', () => {
  it('initialises the language on startup and hosts the router outlet', async () => {
    const init = vi.fn();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: LanguageService, useValue: { init } }],
    }).compileComponents();

    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();

    expect(init).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
  });
});
