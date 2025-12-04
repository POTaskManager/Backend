# Test Plan – Task Manager (Frontend + Backend)

## 1. Cel dokumentu
Celem dokumentu jest opisanie planu testów aplikacji Task Manager, obejmującego:
- zakres testów,
- podejście testowe,
- scenariusze testowe,
- kryteria wejścia i wyjścia,
- role i odpowiedzialności,
- ryzyka,
- harmonogram oraz narzędzia potrzebne do wykonania testów.

---

## 2. Zakres testów

Testowane będą:

### 2.1. Frontend (Next.js)
- Logowanie użytkownika.
- Dashboard (projekty, puste stany).
- Tablica Kanban (tworzenie, edytowanie, przenoszenie i usuwanie zadań).
- Moduł Users & Roles.
- Nawigacja, uprawnienia, routing.
- Walidacje formularzy.
- Integracja z backendem.

### 2.2. Backend (NestJS + Prisma)
- Endpointy API: `/api/auth`, `/api/projects`, `/api/tasks`, `/api/users`, `/api/sprints`.
- Integracja z bazą PostgreSQL.
- Walidacje requestów.
- Błędy i obsługa kodów HTTP.
- Role i uprawnienia (RBAC).

### 2.3. Integracja Frontend ↔ Backend
- Poprawna komunikacja przez REST.
- Scenariusze biznesowe: logowanie → dashboard → board → operacje na zadaniach.

---

## 3. Podejście testowe

Testowanie będzie obejmowało:

### 3.1. Testy manualne
- testy funkcjonalne,
- testy eksploracyjne,
- testy regresyjne.

### 3.2. Testy automatyczne
- **Unit tests**: frontend (Vitest), backend (Nest).
- **Integracyjne**: backend → testy endpointów z test DB.
- **E2E tests**: Playwright → scenariusze użytkownika.

---

## 4. Kryteria wejścia i wyjścia

### 4.1. Kryteria wejścia
- Aplikacja uruchamia się lokalnie (frontend + backend + DB).
- Migracje Prisma wykonane.
- Zdefiniowane dane testowe (kont / projekty / zadania).
- Wdrożony podstawowy zestaw testów automatycznych.

### 4.2. Kryteria wyjścia
- Wszystkie przypadki testowe wykonane.
- Brak krytycznych błędów (severity 1).
- Błędy wysokiego priorytetu naprawione lub zaakceptowane.
- Testy automatyczne (unit + e2e) przechodzą.

---

## 5. Scenariusze testowe

### 5.1. Testy logowania i autoryzacji
- Logowanie poprawne.
- Logowanie błędne (złe dane).
- Sesja użytkownika – odświeżanie strony.
- RBAC:
  - dostęp do /admin tylko dla admina,
  - dostęp do /projects dla member/manager/admin.

### 5.2. Dashboard
- Wyświetlenie listy projektów.
- Puste stany: brak aktywności, brak zadań.
- Przejście do boardu projektu.

### 5.3. Board (Kanban)
- Wyświetlanie kolumn.
- Tworzenie nowego zadania.
- Edycja istniejącego zadania.
- Usuwanie zadania.
- Zmiana statusu (drag & drop lub dropdown).
- Odrzucenie błędnego formularza (walidacja).

### 5.4. Users & Roles
- Wyświetlanie listy użytkowników.
- Nadawanie roli (admin → manager → member).
- Sprawdzenie czy uprawnienia działają po zalogowaniu.

### 5.5. API Backend – testy integracyjne
- `/api/auth/login` → sukces i błędy.
- `/api/projects` → GET/POST/PUT/DELETE.
- `/api/tasks` → CRUD + zmiana statusu.
- `/api/users` → role, dostępność endpointów.
- Walidacja błędów (400, 401, 403, 404, 500).

---

## 6. Matryca pokrycia testów

| Funkcja / Test | Unit | Integracja | E2E | Manual |
|----------------|:----:|:----------:|:---:|:------:|
| Logowanie | ✔ | ✔ | ✔ | ✔ |
| Dashboard | – | ✔ | ✔ | ✔ |
| Board CRUD | ✔ | ✔ | ✔ | ✔ |
| RBAC | ✔ | ✔ | ✔ | ✔ |
| Users / Roles | ✔ | ✔ | ✔ | ✔ |
| Backend API | ✔ | ✔ | – | ✔ |

---

## 7. Ryzyka

- Błędna konfiguracja środowiska (DB, .env).
- Niepełna komunikacja między frontendem a backendem (np. MSW zamiast API).
- Brak danych testowych → puste stany zamiast realnych scenariuszy.
- Złożone uprawnienia — wysoka szansa na edge-case’y.

---

## 8. Narzędzia testowe

- **Frontend:** Vitest, Playwright, React Testing Library  
- **Backend:** Nest testing module, Jest, Supertest  
- **Baza danych:** PostgreSQL + Prisma  
- **Inne:** Postman, pgAdmin, GitHub Actions  

---

## 9. Harmonogram (propozycja)

| Etap | Opis | Czas |
|------|-------|-------|
| Przygotowanie środowiska | instalacja, dane testowe | 1 dzień |
| Testy manualne + eksploracyjne | główne funkcje | 1–2 dni |
| Testy automatyczne | dodanie przypadków e2e/ unit | 2 dni |
| Regresja | sprawdzenie całości | 1 dzień |

---

## 10. Załączniki

- Lista test-case’ów → plik `TEST_CASES.md` (opcjonalnie)
- Strategia testowania → `TEST_STRATEGY.md`

---

## 11. Podsumowanie
Plan testów definiuje, co, jak i kiedy będzie testowane.  
W połączeniu ze strategią testową zapewnia kompletne podejście QA dla aplikacji Task Manager.
