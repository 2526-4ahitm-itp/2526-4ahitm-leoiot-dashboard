// Loading screen and load error (spec model3d/building-viewer).

import { el } from './dom';
import { strings } from './strings';

export class LoadingScreen {
  readonly element = el('div', 'overlay');
  private readonly message = el('p', 'overlay-message', strings.loading);
  private readonly progress = el('p', 'overlay-progress');
  private readonly retry = el('button', 'button', strings.tryAgain);

  /** Called when the user asks to try loading again. */
  onRetry: () => void = () => undefined;

  constructor() {
    this.element.setAttribute('role', 'status');
    this.retry.hidden = true;
    this.retry.addEventListener('click', () => this.onRetry());
    this.element.append(el('h1', 'overlay-title', strings.title), this.message, this.progress, this.retry);
  }

  loading(done: number, total: number, bytes: number): void {
    this.element.classList.remove('overlay-error');
    this.message.textContent = strings.loading;
    this.progress.textContent = strings.loadingProgress(done, total, bytes / 1e6);
    this.retry.hidden = true;
  }

  failed(detail: string): void {
    this.element.classList.add('overlay-error');
    this.message.textContent = strings.loadError;
    this.progress.textContent = detail;
    this.retry.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }

  show(): void {
    this.element.hidden = false;
  }
}
