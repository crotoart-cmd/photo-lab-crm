#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

CAP_PLUGIN(DeviceSmtpPlugin, "DeviceSmtp",
    CAP_PLUGIN_METHOD(isConfigured, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(saveCredentials, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(clearCredentials, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(verify, CAPPluginReturnPromise);
    CAP_PLUGIN_METHOD(sendMail, CAPPluginReturnPromise);
)
