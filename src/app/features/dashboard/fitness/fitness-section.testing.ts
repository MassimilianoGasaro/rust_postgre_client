import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DashboardComponent } from '../dashboard.component';
import { FitnessSectionComponent } from './fitness-section.component';

/** Sostituto della sezione "Forma fisica": stessi input, nessuna richiesta HTTP. */
@Component({ selector: 'app-fitness-section', template: '' })
class FitnessSectionStub {
  readonly range = input<unknown>();
  readonly sportFilter = input<unknown>();
  readonly athleteId = input<unknown>();
  readonly ctx = input<unknown>();
}

/**
 * Nei test della dashboard la sezione "Forma fisica" (testata a parte) viene sostituita,
 * così le sue richieste HTTP non interferiscono con quelle verificate. Va chiamata
 * dopo `configureTestingModule`.
 */
export function stubFitnessSection(): void {
  TestBed.overrideComponent(DashboardComponent, {
    remove: { imports: [FitnessSectionComponent] },
    add: { imports: [FitnessSectionStub] },
  });
}
