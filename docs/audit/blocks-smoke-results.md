# Blocks Smoke Results — ONBO

Estado: ejecutado (catalog + flow) — OK.

## 1) Catalogo de objetos (smoke:blocks:catalog)

- Ejecutado: si
- Resultado: OK (re-ejecutado)
- Evidencia (NOTICE):
  - lesson_blocks: true
  - course_template_lesson_blocks: true
  - v_org_lesson_detail.blocks: true
  - v_superadmin_template_lesson_detail.blocks: true
  - v_lesson_player.blocks: true
  - RPCs org/template: true

## 2) Flow template -> org (smoke:blocks:flow)

- Ejecutado: si
- Resultado: OK
- Evidencia (NOTICE):
  - template blocks in view: 2
  - org blocks table: 2
  - org blocks view: 2
- Conclusión: copy template -> org preserva blocks.

## 3) Faltantes detectados

- Ninguno detectado en los smoke tests actuales.

## 4) Proximos pasos

1. Mantener smoke tests en CI/local cuando se toquen blocks o copy-to-org.
