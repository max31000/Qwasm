// Bliss host API of the web build. Contract: Doc/web.md.
#ifndef WEB_API_H
#define WEB_API_H

#ifdef __EMSCRIPTEN__
extern int bliss_master_volume;  // 0..100
void Bliss_Emit(const char *type, const char *json);
void Bliss_EmitError(const char *message);
void Bliss_Started(void);
void Sys_ResetFrameTime(void);   // sys_sdl.c
#endif

#endif
