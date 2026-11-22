import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ImportDto } from './models';

@Injectable({ providedIn: 'root' })
export class ImportApi {
  private readonly http = inject(HttpClient);

  /** Upload multipart con il campo `files` ripetuto; emette anche gli eventi di progresso. */
  upload(files: File[]): Observable<HttpEvent<ImportDto>> {
    const body = new FormData();
    for (const file of files) {
      body.append('files', file, file.name);
    }
    return this.http.post<ImportDto>('/api/imports', body, {
      reportProgress: true,
      observe: 'events',
    });
  }

  get(id: number): Observable<ImportDto> {
    return this.http.get<ImportDto>(`/api/imports/${id}`);
  }

  /** Ultimi import dell'utente, senza `items`. */
  recent(): Observable<ImportDto[]> {
    return this.http.get<ImportDto[]>('/api/imports');
  }
}
