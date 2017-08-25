using Microsoft.Owin;
using Owin;

[assembly: OwinStartupAttribute(typeof(VSTScustmgmtclean.Startup))]
namespace VSTScustmgmtclean
{
    public partial class Startup
    {
        public void Configuration(IAppBuilder app)
        {
            ConfigureAuth(app);
        }
    }
}
