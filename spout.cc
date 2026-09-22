#include <windows.h>
#include <stdio.h>

extern "C" {

__declspec(dllexport) unsigned long NvOptimusEnablement = 0x00000001;

__declspec(dllexport) int AmdPowerXpressRequestHighPerformance = 1;

}

#include <napi.h>
#include <windows.h>
#include <GL/gl.h>
#include <Spout.h>
#include <memory>
#include <vector>

static HWND g_hwnd = nullptr;
static HDC g_hdc = nullptr;
static HGLRC g_glrc = nullptr;

static std::unique_ptr<Spout> receiver;

static GLuint g_Texture = 0;

static unsigned int g_w = 0;
static unsigned int g_h = 0;

static char g_sender[256] = "";

void DebugGL()
{
    const GLubyte* vendor = glGetString(GL_VENDOR);
    const GLubyte* renderer = glGetString(GL_RENDERER);
    const GLubyte* version = glGetString(GL_VERSION);

    printf(
        "[GL] Vendor: %s\n",
        vendor ? (const char*)vendor : "NULL"
    );

    printf(
        "[GL] Renderer: %s\n",
        renderer ? (const char*)renderer : "NULL"
    );

    printf(
        "[GL] Version: %s\n",
        version ? (const char*)version : "NULL"
    );
}

bool InitGL()
{
    if (g_glrc)
        return true;


    g_hwnd = CreateWindowExA(
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
        printf("[GL] CreateWindow failed\n");
        return false;
    }


    g_hdc = GetDC(g_hwnd);


    PIXELFORMATDESCRIPTOR pfd{};

    pfd.nSize = sizeof(pfd);
    pfd.nVersion = 1;
    pfd.dwFlags =
        PFD_DRAW_TO_WINDOW |
        PFD_SUPPORT_OPENGL |
        PFD_DOUBLEBUFFER;

    pfd.iPixelType = PFD_TYPE_RGBA;
    pfd.cColorBits = 32;
    pfd.cAlphaBits = 8;


    int pf = ChoosePixelFormat(
        g_hdc,
        &pfd
    );


    printf(
        "[GL] PixelFormat=%d\n",
        pf
    );


    if (!pf)
        return false;


    if (!SetPixelFormat(
            g_hdc,
            pf,
            &pfd))
    {
        printf("[GL] SetPixelFormat failed\n");
        return false;
    }


    g_glrc =
        wglCreateContext(
            g_hdc
        );


    if (!g_glrc)
    {
        printf("[GL] wglCreateContext failed\n");
        return false;
    }


    wglMakeCurrent(
        g_hdc,
        g_glrc
    );


    printf("[GL] Context OK\n");

    DebugGL();


    return true;
}

Napi::Value Init(const Napi::CallbackInfo& info)
{
    auto env = info.Env();


    if (!InitGL())
        return Napi::Boolean::New(
            env,
            false
        );


    receiver =
        std::make_unique<Spout>();


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

Napi::Value ReceiveFrame(
    const Napi::CallbackInfo& info)
{
    auto env = info.Env();

    if (!receiver)
        return env.Null();


    wglMakeCurrent(
        g_hdc,
        g_glrc
    );


    if (g_Texture == 0)
    {
        return env.Null();
    }


    bool received =
        receiver->ReceiveTexture(
            g_Texture,
            GL_TEXTURE_2D
        );


    if (!received)
    {
        return env.Null();
    }


    unsigned int w =
        receiver->GetSenderWidth();

    unsigned int h =
        receiver->GetSenderHeight();


    if (w == 0 || h == 0)
    {
        return env.Null();
    }


    if (w != g_w || h != g_h)
    {
        g_w = w;
        g_h = h;

        glDeleteTextures(
            1,
            &g_Texture
        );

        receiver->InitTexture(
            g_Texture,
            GL_RGBA,
            g_w,
            g_h
        );
    }


    size_t size =
        g_w * g_h * 4;


    std::vector<uint8_t> pixels(size);


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

Napi::Value GetSenders(const Napi::CallbackInfo& info)
{
    auto env = info.Env();

    auto arr =
        Napi::Array::New(env);

    if (!receiver)
        return arr;

    int count =
        receiver->GetSenderCount();

    for(int i = 0; i < count; i++)
    {
        char name[256] = {};

        if(receiver->GetSender(i,name))
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

Napi::Value SetSender(
    const Napi::CallbackInfo& info)
{
    auto env = info.Env();


    if (info.Length() < 1)
        return env.Null();


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
        printf("[Spout] ERROR empty sender\n");

        return Napi::Boolean::New(
            env,
            false
        );
    }


    wglMakeCurrent(
        g_hdc,
        g_glrc
    );


    if (receiver)
    {
        receiver->ReleaseReceiver();
        receiver.reset();

        printf(
            "[Spout] Old receiver released\n"
        );
    }


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


    receiver->SetReceiverName(
        senderName
    );


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
        return Napi::Boolean::New(
            env,
            false
        );


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

Napi::Object InitModule(
    Napi::Env env,
    Napi::Object exports)
{
    exports.Set(
        "init",
        Napi::Function::New(
            env,
            Init
        )
    );

    exports.Set(
        "receiveFrame",
        Napi::Function::New(
            env,
            ReceiveFrame
        )
    );

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

    return exports;
}

NODE_API_MODULE(
    spout,
    InitModule
)