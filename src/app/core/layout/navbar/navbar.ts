import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LanguageService, Language } from '../../services/language';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class NavbarComponent {
  langService = inject(LanguageService);
  t = this.langService.t;
  currentLang = this.langService.currentLanguage;

  pageTitle = 'Dashboard';
  currentDate = new Date();
  
  showLangMenu = false;

  setLang(lang: Language) {
    this.langService.setLanguage(lang);
    this.showLangMenu = false;
  }
}
