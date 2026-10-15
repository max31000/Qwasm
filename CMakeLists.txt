# Bliss web build of Qwasm (software renderer, Emscripten only).
#   emcmake cmake -S . -B build-web -G Ninja -DCMAKE_BUILD_TYPE=Release
#   cmake --build build-web            -> build-web/bin/quake.{js,wasm}
# Host contract: Doc/web.md. The upstream Makefile.emscripten (standalone page) is untouched.
cmake_minimum_required(VERSION 3.16)
project(QuakeWeb C)

if(NOT EMSCRIPTEN)
    message(FATAL_ERROR "This CMakeLists.txt only supports Emscripten (emcmake cmake ...)")
endif()

set(Q "${CMAKE_CURRENT_LIST_DIR}/WinQuake")
set(WEB_DIR "${Q}/web")

set(SOURCES
    chase.c cl_demo.c cl_input.c cl_main.c cl_parse.c cl_tent.c cmd.c common.c console.c crc.c
    cvar.c host.c host_cmd.c keys.c mathlib.c menu.c net_bsd.c net_dgrm.c net_loop.c net_main.c
    net_udp.c net_vcr.c pr_cmds.c pr_edict.c pr_exec.c r_part.c sbar.c snd_dma.c snd_mem.c
    snd_mix.c sv_main.c sv_move.c sv_phys.c sv_user.c view.c wad.c world.c zone.c
    # software renderer (WinQuake)
    d_edge.c d_fill.c d_init.c d_modech.c d_part.c d_polyse.c d_scan.c d_sky.c d_sprite.c
    d_surf.c d_vars.c d_zpoint.c draw.c model.c nonintel.c r_aclip.c r_alias.c r_bsp.c r_draw.c
    r_edge.c r_efrag.c r_light.c r_main.c r_misc.c r_sky.c r_sprite.c r_surf.c r_vars.c screen.c
    # platform
    cd_null.c snd_sdl.c sys_sdl.c vid_sdl.c web_api.c)
list(TRANSFORM SOURCES PREPEND "${Q}/")

add_executable(quake ${SOURCES})
set(CMAKE_EXECUTABLE_SUFFIX ".js")
set_target_properties(quake PROPERTIES SUFFIX ".js" RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/bin")

target_compile_definitions(quake PRIVATE SDL BLISS_WEB)
target_compile_options(quake PRIVATE -O3 -ffast-math -fomit-frame-pointer -sUSE_SDL=2
    -Wall -Wno-implicit-function-declaration -Wno-unused-parameter -Wno-missing-field-initializers
    -Wno-sign-compare -Wno-pointer-sign -Wno-unused-variable -Wno-unused-but-set-variable
    -Wno-dangling-else -Wno-parentheses -Wno-unused-function -Wno-format-security)

set(WEB_EXPORTS "_main,_bliss_pause,_bliss_resume,_bliss_is_paused,_bliss_set_master_volume,_bliss_get_master_volume,_bliss_set_mouse_sensitivity,_bliss_get_mouse_sensitivity,_bliss_new_game,_bliss_command,_bliss_clear_keys,_bliss_pointer_lock_lost,_malloc,_free")
# Settings are id Software's own: quake.rc runs default.cfg from pak0.pak (original key bindings,
# gamma 1.0, ...), then the saved config.cfg (IDBFS), then web/autoexec.cfg (embedded: +mlook).
# Qwasm's config.cfg/wasm.cfg (WASD, gamma 0.65) are not used by the Bliss build.
# pak0.pak is written by the host into /data/id1 (preRun).
set(WEB_LINK_FLAGS
    "-O3 -sUSE_SDL=2 -sINITIAL_MEMORY=64MB -sSTACK_SIZE=2MB -sALLOW_MEMORY_GROWTH=1"
    "-sENVIRONMENT=web -lidbfs.js"
    "-sMODULARIZE=1 -sEXPORT_ES6=1 -sEXPORT_NAME=createQuake"
    "-sEXPORTED_FUNCTIONS=${WEB_EXPORTS}"
    "-sEXPORTED_RUNTIME_METHODS=ccall,cwrap,UTF8ToString,stringToUTF8,FS,addRunDependency,removeRunDependency"
    "--embed-file ${WEB_DIR}/autoexec.cfg@/data/id1/autoexec.cfg"
    "--pre-js ${WEB_DIR}/pre.js --pre-js ${WEB_DIR}/pre-mouse.js --js-library ${WEB_DIR}/library_bliss.js")
string(REPLACE ";" " " WEB_LINK_FLAGS "${WEB_LINK_FLAGS}")
set_target_properties(quake PROPERTIES LINK_FLAGS "${WEB_LINK_FLAGS}")
set_property(TARGET quake APPEND PROPERTY LINK_DEPENDS
    "${WEB_DIR}/pre.js;${WEB_DIR}/pre-mouse.js;${WEB_DIR}/library_bliss.js;${WEB_DIR}/autoexec.cfg")
