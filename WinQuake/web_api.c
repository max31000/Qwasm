// Bliss host API of the web build (exports + onBlissEvent). Contract: Doc/web.md.
#ifdef __EMSCRIPTEN__

#include <stdio.h>
#include <emscripten.h>
#include "SDL.h"
#include "quakedef.h"
#include "web_api.h"

int bliss_master_volume = 100;  // 0..100, applied in the SDL audio callback (snd_sdl.c)
static int bliss_paused = 0;

void Bliss_Emit(const char *type, const char *json)
{
	EM_ASM({
		var type = UTF8ToString($0);
		var json = UTF8ToString($1);
		if (Module["blissOnEventInternal"]) Module["blissOnEventInternal"](type, json);
		var cb = Module["onBlissEvent"];
		if (typeof cb != "function") return;
		try { cb(type, json); }
		catch (e) { console.error("[bliss] onBlissEvent handler failed", e); }
	}, type, json ? json : "{}");
}

// JSON string body escaping for short engine messages.
static void json_escape(char *out, size_t size, const char *in)
{
	size_t o = 0;
	for (; *in && o + 7 < size; in++)
	{
		unsigned char c = (unsigned char)*in;
		if (c == '"' || c == '\\') { out[o++] = '\\'; out[o++] = c; }
		else if (c == '\n') { out[o++] = '\\'; out[o++] = 'n'; }
		else if (c < 0x20 || c >= 0x7f) { o += snprintf(out + o, size - o, "\\u%04x", c); }
		else out[o++] = c;
	}
	out[o] = '\0';
}

void Bliss_EmitError(const char *message)
{
	char esc[1024], json[1100];
	json_escape(esc, sizeof(esc), message);
	snprintf(json, sizeof(json), "{\"message\":\"%s\"}", esc);
	Bliss_Emit("error", json);
}

void Bliss_Started(void)
{
	char json[64];
	snprintf(json, sizeof(json), "{\"width\":%d,\"height\":%d}", vid.width, vid.height);
	Bliss_Emit("started", json);
}

EMSCRIPTEN_KEEPALIVE void bliss_clear_keys(void)
{
	// Releases every held key (+forward etc.), e.g. when the canvas loses focus.
	Key_ClearStates();
}

EMSCRIPTEN_KEEPALIVE void bliss_pause(void)
{
	if (bliss_paused)
		return;
	bliss_paused = 1;
	Key_ClearStates();
	emscripten_pause_main_loop();
	SDL_PauseAudio(1);
	Bliss_Emit("pauseChanged", "{\"paused\":true}");
}

EMSCRIPTEN_KEEPALIVE void bliss_resume(void)
{
	if (!bliss_paused)
		return;
	bliss_paused = 0;
	Sys_ResetFrameTime();  // no catch-up step for the paused time
	SDL_PauseAudio(0);
	emscripten_resume_main_loop();
	Bliss_Emit("pauseChanged", "{\"paused\":false}");
}

EMSCRIPTEN_KEEPALIVE int bliss_is_paused(void)
{
	return bliss_paused;
}

EMSCRIPTEN_KEEPALIVE void bliss_set_master_volume(int volume)
{
	if (volume < 0) volume = 0;
	if (volume > 100) volume = 100;
	bliss_master_volume = volume;
}

EMSCRIPTEN_KEEPALIVE int bliss_get_master_volume(void)
{
	return bliss_master_volume;
}

// Quake's "sensitivity" cvar (menu slider range 1..11, Qwasm default 4).
EMSCRIPTEN_KEEPALIVE void bliss_set_mouse_sensitivity(float value)
{
	if (value < 0.1f) value = 0.1f;
	if (value > 30.0f) value = 30.0f;
	Cvar_SetValue("sensitivity", value);
}

EMSCRIPTEN_KEEPALIVE float bliss_get_mouse_sensitivity(void)
{
	return sensitivity.value;
}

// Starts episode 1 from the start map (like Single Player -> New Game); skill 0..3.
EMSCRIPTEN_KEEPALIVE void bliss_new_game(int skill)
{
	char cmd[64];
	if (skill < 0) skill = 0;
	if (skill > 3) skill = 3;
	key_dest = key_game;
	if (sv.active)
		Cbuf_AddText("disconnect\n");
	snprintf(cmd, sizeof(cmd), "skill %d\nmaxplayers 1\nmap start\n", skill);
	Cbuf_AddText(cmd);
}

// Runs a console command line (e.g. "bind x +jump", "volume 0.5").
EMSCRIPTEN_KEEPALIVE void bliss_command(const char *line)
{
	if (!line || !*line)
		return;
	Cbuf_AddText((char *)line);
	Cbuf_AddText("\n");
}

#endif // __EMSCRIPTEN__
