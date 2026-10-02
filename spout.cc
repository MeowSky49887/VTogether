#include <windows.h>
#include <stdio.h>
#include <string>
#include <memory>
#include <vector>
#include <stdint.h>

//
// GPU selection
//
extern "C" {

__declspec(dllexport)
unsigned long NvOptimusEnablement = 0x00000001;

__declspec(dllexport)
int AmdPowerXpressRequestHighPerformance = 1;

}

#include <napi.h>
#include <GL/gl.h>
#include <Spout.h>


// ============================================================
// OpenGL Context
// ============================================================

static HWND g_hwnd = nullptr;
static HDC g_hdc = nullptr;
static HGLRC g_glrc = nullptr;


// ============================================================
// Spout Receiver
// ============================================================

static std::unique_ptr<Spout> receiver;

static GLuint g_Texture = 0;

static unsigned int g_w = 0;
static unsigned int g_h = 0;

static char g_receiverName[256] = "";


// ============================================================
// Spout Sender
// ============================================================

static std::unique_ptr<Spout> sender;

static GLuint g_SendTexture = 0;

static unsigned int g_sendW = 0;
static unsigned int g_sendH = 0;

static char g_senderName[256] = "";


// ============================================================
// Debug OpenGL
// ============================================================

void DebugGL()
{
    const GLubyte* vendor =
        glGetString(GL_VENDOR);

    const GLubyte* renderer =
        glGetString(GL_RENDERER);

    const GLubyte* version =
        glGetString(GL_VERSION);

    printf(
        "[GL] Vendor: %s\n",
        vendor
            ? (const char*)vendor
            : "NULL"
    );

    printf(
        "[GL] Renderer: %s\n",
        renderer
            ? (const char*)renderer
            : "NULL"
    );

    printf(
        "[GL] Version: %s\n",
        version
            ? (const char*)version
            : "NULL"
    );
}


// ============================================================
// Initialize OpenGL
// ============================================================

bool InitGL()
{
    if (g_glrc)
        return true;


    //
    // Create hidden window
    //
    g_hwnd =
        CreateWindowExA(
            0,
            "STATIC",
            "SpoutHidden",
            WS_POPUP,
            0,
            0,
            1,
            1,
            NULL,
            NULL,
            GetModuleHandle(NULL),
            NULL
        );


    if (!g_hwnd)
    {
        printf(
            "[GL] CreateWindow failed\n"
        );

        return false;
    }


    //
    // Device context
    //
    g_hdc =
        GetDC(g_hwnd);


    if (!g_hdc)
    {
        printf(
            "[GL] GetDC failed\n"
        );

        return false;
    }


    //
    // Pixel format
    //
    PIXELFORMATDESCRIPTOR pfd{};

    pfd.nSize =
        sizeof(pfd);

    pfd.nVersion =
        1;

    pfd.dwFlags =
        PFD_DRAW_TO_WINDOW |
        PFD_SUPPORT_OPENGL |
        PFD_DOUBLEBUFFER;

    pfd.iPixelType =
        PFD_TYPE_RGBA;

    pfd.cColorBits =
        32;

    pfd.cAlphaBits =
        8;


    int pf =
        ChoosePixelFormat(
            g_hdc,
            &pfd
        );


    printf(
        "[GL] PixelFormat=%d\n",
        pf
    );


    if (!pf)
    {
        printf(
            "[GL] ChoosePixelFormat failed\n"
        );

        return false;
    }


    if (!SetPixelFormat(
            g_hdc,
            pf,
            &pfd))
    {
        printf(
            "[GL] SetPixelFormat failed\n"
        );

        return false;
    }


    //
    // Create legacy OpenGL context
    //
    g_glrc =
        wglCreateContext(
            g_hdc
        );


    if (!g_glrc)
    {
        printf(
            "[GL] wglCreateContext failed\n"
        );

        return false;
    }


    if (!wglMakeCurrent(
            g_hdc,
            g_glrc))
    {
        printf(
            "[GL] wglMakeCurrent failed\n"
        );

        return false;
    }


    printf(
        "[GL] Context OK\n"
    );


    DebugGL();


    return true;
}


// ============================================================
// INIT
// ============================================================

Napi::Value Init(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (!InitGL())
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    //
    // Create receiver object
    //
    if (!receiver)
    {
        receiver =
            std::make_unique<Spout>();
    }


    printf(
        "[Spout] Receiver created\n"
    );


    printf(
        "[Spout] Senders=%d\n",
        receiver->GetSenderCount()
    );


    return Napi::Boolean::New(
        env,
        true
    );
}


// ============================================================
// GET SENDERS
// ============================================================

Napi::Value GetSenders(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    auto arr =
        Napi::Array::New(env);


    if (!receiver)
        return arr;


    int count =
        receiver->GetSenderCount();


    for (int i = 0; i < count; i++)
    {
        char name[256] = {};


        if (receiver->GetSender(
                i,
                name))
        {
            arr.Set(
                i,
                Napi::String::New(
                    env,
                    name
                )
            );
        }
    }


    return arr;
}


// ============================================================
// SET RECEIVER SENDER
// ============================================================

Napi::Value SetSender(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (info.Length() < 1)
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    if (!info[0].IsString())
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    std::string name =
        info[0]
            .As<Napi::String>()
            .Utf8Value();


    printf(
        "[Spout] SetSender name='%s' length=%zu\n",
        name.c_str(),
        name.length()
    );


    if (name.empty())
    {
        printf(
            "[Spout] ERROR empty sender\n"
        );

        return Napi::Boolean::New(
            env,
            false
        );
    }


    if (!InitGL())
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    wglMakeCurrent(
        g_hdc,
        g_glrc
    );


    //
    // Release old receiver
    //
    if (receiver)
    {
        receiver->ReleaseReceiver();

        receiver.reset();

        printf(
            "[Spout] Old receiver released\n"
        );
    }


    //
    // Delete receiver texture
    //
    if (g_Texture)
    {
        glDeleteTextures(
            1,
            &g_Texture
        );

        g_Texture = 0;
    }


    receiver =
        std::make_unique<Spout>();


    char senderName[256] = {};


    strcpy_s(
        senderName,
        sizeof(senderName),
        name.c_str()
    );


    g_w = 0;
    g_h = 0;


    //
    // Set receiver name
    //
    receiver->SetReceiverName(
        senderName
    );


    //
    // Create receiver
    //
    bool ok =
        receiver->CreateReceiver(
            senderName,
            g_w,
            g_h
        );


    char actual[256] = {};


    receiver->GetReceiverName(
        actual
    );


    printf(
        "[Spout] Create=%d\n",
        ok
    );

    printf(
        "[Spout] Requested=%s\n",
        senderName
    );

    printf(
        "[Spout] Actual=%s\n",
        actual
    );

    printf(
        "[Spout] Size=%ux%u\n",
        g_w,
        g_h
    );


    if (!ok)
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    //
    // Create receiver texture
    //
    receiver->InitTexture(
        g_Texture,
        GL_RGBA,
        g_w,
        g_h
    );


    printf(
        "[Spout] Texture=%u\n",
        g_Texture
    );


    return Napi::Boolean::New(
        env,
        true
    );
}


// ============================================================
// RECEIVE FRAME
// ============================================================

Napi::Value ReceiveFrame(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (!receiver)
        return env.Null();


    if (!g_glrc)
        return env.Null();


    if (!wglMakeCurrent(
            g_hdc,
            g_glrc))
    {
        return env.Null();
    }


    if (g_Texture == 0)
    {
        return env.Null();
    }


    //
    // Receive Spout texture
    //
    bool received =
        receiver->ReceiveTexture(
            g_Texture,
            GL_TEXTURE_2D
        );


    if (!received)
    {
        return env.Null();
    }


    //
    // Get sender size
    //
    unsigned int w =
        receiver->GetSenderWidth();

    unsigned int h =
        receiver->GetSenderHeight();


    if (w == 0 || h == 0)
    {
        return env.Null();
    }


    //
    // Resize
    //
    if (w != g_w ||
        h != g_h)
    {
        g_w = w;
        g_h = h;


        if (g_Texture)
        {
            glDeleteTextures(
                1,
                &g_Texture
            );

            g_Texture = 0;
        }


        receiver->InitTexture(
            g_Texture,
            GL_RGBA,
            g_w,
            g_h
        );
    }


    //
    // RGBA8
    //
    size_t size =
        (size_t)g_w *
        (size_t)g_h *
        4;


    std::vector<uint8_t> pixels(
        size
    );


    //
    // Read texture
    //
    glBindTexture(
        GL_TEXTURE_2D,
        g_Texture
    );


    glGetTexImage(
        GL_TEXTURE_2D,
        0,
        GL_RGBA,
        GL_UNSIGNED_BYTE,
        pixels.data()
    );


    glBindTexture(
        GL_TEXTURE_2D,
        0
    );


    //
    // Return JS object
    //
    auto obj =
        Napi::Object::New(env);


    obj.Set(
        "width",
        g_w
    );


    obj.Set(
        "height",
        g_h
    );


    obj.Set(
        "data",
        Napi::Buffer<uint8_t>::Copy(
            env,
            pixels.data(),
            size
        )
    );


    return obj;
}


// ============================================================
// CREATE SPOUT SENDER
// ============================================================

Napi::Value CreateSpoutSender(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (info.Length() < 3)
    {
        Napi::TypeError::New(
            env,
            "createSender(name, width, height)"
        ).ThrowAsJavaScriptException();

        return env.Null();
    }


    if (!info[0].IsString() ||
        !info[1].IsNumber() ||
        !info[2].IsNumber())
    {
        Napi::TypeError::New(
            env,
            "Invalid arguments"
        ).ThrowAsJavaScriptException();

        return env.Null();
    }


    std::string name =
        info[0]
            .As<Napi::String>()
            .Utf8Value();


    unsigned int width =
        info[1]
            .As<Napi::Number>()
            .Uint32Value();


    unsigned int height =
        info[2]
            .As<Napi::Number>()
            .Uint32Value();


    if (name.empty())
    {
        printf(
            "[Spout Sender] Empty name\n"
        );

        return Napi::Boolean::New(
            env,
            false
        );
    }


    if (width == 0 ||
        height == 0)
    {
        printf(
            "[Spout Sender] Invalid size %ux%u\n",
            width,
            height
        );

        return Napi::Boolean::New(
            env,
            false
        );
    }


    if (!InitGL())
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    wglMakeCurrent(
        g_hdc,
        g_glrc
    );


    //
    // Release previous sender
    //
    if (sender)
    {
        sender->ReleaseSender();

        sender.reset();

        printf(
            "[Spout Sender] Previous sender released\n"
        );
    }


    //
    // Delete previous texture
    //
    if (g_SendTexture)
    {
        glDeleteTextures(
            1,
            &g_SendTexture
        );

        g_SendTexture = 0;
    }


    sender =
        std::make_unique<Spout>();


    strcpy_s(
        g_senderName,
        sizeof(g_senderName),
        name.c_str()
    );


    g_sendW = width;
    g_sendH = height;


    //
    // Create Spout sender
    //
    bool ok =
        sender->CreateSender(
            g_senderName,
            g_sendW,
            g_sendH
        );


    printf(
        "[Spout Sender] CreateSender=%d\n",
        ok
    );


    printf(
        "[Spout Sender] Name=%s\n",
        g_senderName
    );


    printf(
        "[Spout Sender] Size=%ux%u\n",
        g_sendW,
        g_sendH
    );


    if (!ok)
    {
        sender.reset();

        return Napi::Boolean::New(
            env,
            false
        );
    }


    //
    // Create OpenGL texture
    //
    glGenTextures(
        1,
        &g_SendTexture
    );


    if (!g_SendTexture)
    {
        printf(
            "[Spout Sender] glGenTextures failed\n"
        );

        sender->ReleaseSender();
        sender.reset();

        return Napi::Boolean::New(
            env,
            false
        );
    }


    glBindTexture(
        GL_TEXTURE_2D,
        g_SendTexture
    );


    glTexParameteri(
        GL_TEXTURE_2D,
        GL_TEXTURE_MIN_FILTER,
        GL_LINEAR
    );


    glTexParameteri(
        GL_TEXTURE_2D,
        GL_TEXTURE_MAG_FILTER,
        GL_LINEAR
    );


    glTexParameteri(
        GL_TEXTURE_2D,
        GL_TEXTURE_WRAP_S,
        GL_CLAMP
    );


    glTexParameteri(
        GL_TEXTURE_2D,
        GL_TEXTURE_WRAP_T,
        GL_CLAMP
    );


    //
    // Allocate texture
    //
    glTexImage2D(
        GL_TEXTURE_2D,
        0,
        GL_RGBA8,
        g_sendW,
        g_sendH,
        0,
        GL_BGRA,
        GL_UNSIGNED_BYTE,
        nullptr
    );


    glBindTexture(
        GL_TEXTURE_2D,
        0
    );


    printf(
        "[Spout Sender] Texture=%u\n",
        g_SendTexture
    );


    return Napi::Boolean::New(
        env,
        true
    );
}


// ============================================================
// SEND FRAME
//
// JavaScript:
//
// spout.sendFrame(
//     buffer,
//     width,
//     height
// );
//
// buffer = Electron nativeImage.toBitmap()
// format = BGRA
//
// ============================================================

Napi::Value SendFrame(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (!sender)
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    if (!g_glrc ||
        !g_SendTexture)
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    if (info.Length() < 3)
    {
        Napi::TypeError::New(
            env,
            "sendFrame(buffer, width, height)"
        ).ThrowAsJavaScriptException();

        return env.Null();
    }


    if (!info[0].IsBuffer() ||
        !info[1].IsNumber() ||
        !info[2].IsNumber())
    {
        Napi::TypeError::New(
            env,
            "Invalid arguments"
        ).ThrowAsJavaScriptException();

        return env.Null();
    }


    Napi::Buffer<uint8_t> buffer =
        info[0]
            .As<Napi::Buffer<uint8_t>>();


    unsigned int width =
        info[1]
            .As<Napi::Number>()
            .Uint32Value();


    unsigned int height =
        info[2]
            .As<Napi::Number>()
            .Uint32Value();


    if (width == 0 ||
        height == 0)
    {
        return Napi::Boolean::New(
            env,
            false
        );
    }


    size_t requiredSize =
        (size_t)width *
        (size_t)height *
        4;


    if (buffer.Length() < requiredSize)
    {
        printf(
            "[Spout Sender] Invalid buffer size %zu < %zu\n",
            buffer.Length(),
            requiredSize
        );

        return Napi::Boolean::New(
            env,
            false
        );
    }


    //
    // Make OpenGL context current
    //
    if (!wglMakeCurrent(
            g_hdc,
            g_glrc))
    {
        printf(
            "[Spout Sender] wglMakeCurrent failed\n"
        );

        return Napi::Boolean::New(
            env,
            false
        );
    }


    //
    // Resize sender if required
    //
    if (width != g_sendW ||
        height != g_sendH)
    {
        printf(
            "[Spout Sender] Resize %ux%u -> %ux%u\n",
            g_sendW,
            g_sendH,
            width,
            height
        );


        g_sendW = width;
        g_sendH = height;


        //
        // Update Spout sender
        //
        sender->UpdateSender(
            g_senderName,
            g_sendW,
            g_sendH
        );


        //
        // Resize OpenGL texture
        //
        glBindTexture(
            GL_TEXTURE_2D,
            g_SendTexture
        );


        glTexImage2D(
            GL_TEXTURE_2D,
            0,
            GL_RGBA8,
            g_sendW,
            g_sendH,
            0,
            GL_BGRA,
            GL_UNSIGNED_BYTE,
            nullptr
        );


        glBindTexture(
            GL_TEXTURE_2D,
            0
        );
    }


    //
    // Upload Electron BGRA buffer
    //
    glBindTexture(
        GL_TEXTURE_2D,
        g_SendTexture
    );


    glPixelStorei(
        GL_UNPACK_ALIGNMENT,
        4
    );


    glTexSubImage2D(
        GL_TEXTURE_2D,
        0,
        0,
        0,
        width,
        height,
        GL_BGRA,
        GL_UNSIGNED_BYTE,
        buffer.Data()
    );


    //
    // Check OpenGL error
    //
    GLenum uploadError =
        glGetError();


    if (uploadError != GL_NO_ERROR)
    {
        printf(
            "[Spout Sender] glTexSubImage2D error=0x%X\n",
            uploadError
        );

        glBindTexture(
            GL_TEXTURE_2D,
            0
        );

        return Napi::Boolean::New(
            env,
            false
        );
    }


    //
    // Send texture through Spout
    //
    bool ok =
        sender->SendTexture(
            g_SendTexture,
            GL_TEXTURE_2D,
            width,
            height,
            false
        );


    glBindTexture(
        GL_TEXTURE_2D,
        0
    );


    if (!ok)
    {
        printf(
            "[Spout Sender] SendTexture failed\n"
        );
    }


    return Napi::Boolean::New(
        env,
        ok
    );
}


// ============================================================
// RELEASE SPOUT SENDER
// ============================================================

Napi::Value ReleaseSpoutSender(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (g_glrc)
    {
        wglMakeCurrent(
            g_hdc,
            g_glrc
        );
    }


    //
    // Release Spout sender
    //
    if (sender)
    {
        sender->ReleaseSender();

        sender.reset();

        printf(
            "[Spout Sender] Released\n"
        );
    }


    //
    // Delete OpenGL texture
    //
    if (g_SendTexture)
    {
        glDeleteTextures(
            1,
            &g_SendTexture
        );

        g_SendTexture = 0;
    }


    g_sendW = 0;
    g_sendH = 0;


    memset(
        g_senderName,
        0,
        sizeof(g_senderName)
    );


    return Napi::Boolean::New(
        env,
        true
    );
}


// ============================================================
// RELEASE EVERYTHING
// ============================================================

Napi::Value Release(
    const Napi::CallbackInfo& info)
{
    auto env =
        info.Env();


    if (g_glrc)
    {
        wglMakeCurrent(
            g_hdc,
            g_glrc
        );
    }


    //
    // Sender
    //
    if (sender)
    {
        sender->ReleaseSender();

        sender.reset();
    }


    if (g_SendTexture)
    {
        glDeleteTextures(
            1,
            &g_SendTexture
        );

        g_SendTexture = 0;
    }


    //
    // Receiver
    //
    if (receiver)
    {
        receiver->ReleaseReceiver();

        receiver.reset();
    }


    if (g_Texture)
    {
        glDeleteTextures(
            1,
            &g_Texture
        );

        g_Texture = 0;
    }


    //
    // OpenGL
    //
    if (g_glrc)
    {
        wglMakeCurrent(
            NULL,
            NULL
        );

        wglDeleteContext(
            g_glrc
        );

        g_glrc = nullptr;
    }


    if (g_hdc &&
        g_hwnd)
    {
        ReleaseDC(
            g_hwnd,
            g_hdc
        );

        g_hdc = nullptr;
    }


    if (g_hwnd)
    {
        DestroyWindow(
            g_hwnd
        );

        g_hwnd = nullptr;
    }


    g_w = 0;
    g_h = 0;

    g_sendW = 0;
    g_sendH = 0;


    memset(
        g_receiverName,
        0,
        sizeof(g_receiverName)
    );


    memset(
        g_senderName,
        0,
        sizeof(g_senderName)
    );


    printf(
        "[Spout] Released\n"
    );


    return Napi::Boolean::New(
        env,
        true
    );
}


// ============================================================
// MODULE INIT
// ============================================================

Napi::Object InitModule(
    Napi::Env env,
    Napi::Object exports)
{
    //
    // General
    //
    exports.Set(
        "init",
        Napi::Function::New(
            env,
            Init
        )
    );


    exports.Set(
        "release",
        Napi::Function::New(
            env,
            Release
        )
    );


    //
    // Receiver
    //
    exports.Set(
        "getSenders",
        Napi::Function::New(
            env,
            GetSenders
        )
    );


    exports.Set(
        "setSender",
        Napi::Function::New(
            env,
            SetSender
        )
    );


    exports.Set(
        "receiveFrame",
        Napi::Function::New(
            env,
            ReceiveFrame
        )
    );


    //
    // Spout Sender
    //
    exports.Set(
        "createSender",
        Napi::Function::New(
            env,
            CreateSpoutSender
        )
    );


    exports.Set(
        "sendFrame",
        Napi::Function::New(
            env,
            SendFrame
        )
    );


    exports.Set(
        "releaseSender",
        Napi::Function::New(
            env,
            ReleaseSpoutSender
        )
    );


    return exports;
}


// ============================================================
// NODE API MODULE
// ============================================================

NODE_API_MODULE(
    spout,
    InitModule
)