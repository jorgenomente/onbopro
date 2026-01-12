# Smoke Test — Quiz Bulk Import (ONBO-QUIZ v1)

## Objetivo

Validar import masivo de preguntas con formato ONBO-QUIZ v1.

## Pasos

1. En el editor del quiz (org admin), abrir “Importar preguntas”.
2. Pegar 3 bloques válidos y previsualizar.
3. Importar y confirmar:
   - aparecen 3 preguntas nuevas
   - cada una tiene 4 opciones
   - exactamente 1 correcta
4. Pegar 1 bloque con error (CORRECT=5) y confirmar que el reporte lo marca como inválido.

## Datos de ejemplo

```
---
Q: ¿Cuál es el EPP obligatorio?
A1: Casco
A2: Gorra
A3: Bufanda
A4: Zapatillas
CORRECT: 1
---
Q: ¿Qué hacer ante un derrame?
A1: Ignorar
A2: Reportar
A3: Limpiar sin aviso
A4: Esperar
CORRECT: 2
EXPLAIN: Debe reportarse a seguridad.
---
Q: ¿Dónde se registran incidentes?
A1: En un cuaderno personal
A2: En el sistema de reportes
A3: En redes sociales
A4: No se registran
CORRECT: 2
---
```
