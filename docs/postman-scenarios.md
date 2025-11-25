# Postman – scenariusze testowe (dev stack)

## Ustawienia środowiska
- `baseUrl`: URL backendu z prefiksem `/api`, np. `http://localhost:3000/api` (lub `http://<host>:3000/api` na zdalnej maszynie).
- `userId`, `projectId`, `boardId`, `sprintId`, `taskId`, `accessToken`: uzupełniaj w trakcie wykonywania scenariusza z odpowiedzi poprzednich kroków.

## Scenariusze CRUD (Users → Projects → Boards → Sprints → Tasks)
1) **POST {{baseUrl}}/users** – utworzenie użytkownika  
   Body (JSON):
   ```json
   {
     "firstName": "Jan",
     "lastName": "Kowalski",
     "email": "jan@example.com",
     "password": "P@ssw0rd123"
   }
   ```
   Oczekiwane: 201/200, ciało z `user_userId` → zapisz jako `userId`.

2) **GET {{baseUrl}}/users** – lista użytkowników  
   Oczekiwane: 200, tablica zawiera użytkownika z poprzedniego kroku.

3) **POST {{baseUrl}}/projects** – utworzenie projektu  
   Body:
   ```json
   {
     "name": "Projekt A",
     "description": "Opis",
     "ownerId": "{{userId}}",
     "state": "active"
   }
   ```
   Oczekiwane: 201/200, `proj_projId` → `projectId`.

4) **POST {{baseUrl}}/boards** – utworzenie tablicy  
   Body:
   ```json
   {
     "projectId": "{{projectId}}",
     "name": "Tablica 1",
     "type": "kanban"
   }
   ```
   Oczekiwane: 201/200, `board_boardId` → `boardId`.

5) **POST {{baseUrl}}/sprints** – utworzenie sprintu  
   Body:
   ```json
   {
     "boardId": "{{boardId}}",
     "name": "Sprint 1",
     "state": "planned"
   }
   ```
   Oczekiwane: 201/200, `spr_sprId` → `sprintId`.

6) **POST {{baseUrl}}/tasks** – utworzenie zadania  
   Body:
   ```json
   {
     "boardId": "{{boardId}}",
     "sprintId": "{{sprintId}}",
     "createdBy": "{{userId}}",
     "title": "Zadanie 1",
     "state": "todo",
     "priority": "medium"
   }
   ```
   Oczekiwane: 201/200, `task_taskId` → `taskId`.

7) **GET {{baseUrl}}/tasks/{{taskId}}** – pobranie zadania  
   Oczekiwane: 200, pola zgodne z utworzonym zadaniem.

## Scenariusze OAuth mock (Google)
8) **POST {{baseUrl}}/auth/oauth/exchange** – wymiana code → tokeny (mock)  
   Body:
   ```json
   {
     "provider": "google",
     "authorizationCode": "code:mockuser@example.com",
     "userId": "{{userId}}"
   }
   ```
   Oczekiwane: 200, ciało zawiera `accessToken`, `refreshToken`, `expiresAt`, `idToken`, `userProfile`. Zapisz `accessToken`.

9) **POST {{baseUrl}}/auth/oauth/userinfo** – pobranie profilu z access tokena  
   Body:
   ```json
   {
     "accessToken": "{{accessToken}}"
   }
   ```
   Oczekiwane: 200, profil użytkownika; dla błędnego tokena 404.

10) **POST {{baseUrl}}/auth/sessions** – utworzenie sesji na podstawie zapisanego tokenu  
    Body:
    ```json
    {
      "userId": "{{userId}}",
      "provider": "google",
      "accessToken": "{{accessToken}}"
    }
    ```
    Oczekiwane: 200, sesja z `sessionId`, `tokenPreview`.

11) **GET {{baseUrl}}/auth/sessions** – lista sesji w pamięci  
    Oczekiwane: 200, tablica z sesją z poprzedniego kroku.

## Minimalne asercje ręczne w Postmanie
- Status code zgodny z oczekiwaniem (200/201); dla złego tokena w userinfo: 404.
- Pola wymagane obecne: `user_userId` po utworzeniu usera, `proj_projId`, `board_boardId`, `spr_sprId`, `task_taskId`, `accessToken` w exchange, `sessionId` w sessions.
- Walidacja błędów: usuń wymagane pole (np. `title` w tasks) i oczekuj 400 z komunikatem walidacji (ValidationPipe jest włączony).
