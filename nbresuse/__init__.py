import os
import json
import psutil
import time
from traitlets import Float, Int, default
from traitlets.config import Configurable
from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler
import GPUtil

# Py2 / Py3 throw different errors
try:
    FileNotFoundError
except NameError:
    FileNotFoundError = IOError

class MetricsHandler(IPythonHandler):
    def get(self):
        """
        Calculate and return current resource usage metrics
        """
        config = self.settings['nbresuse_display_config']
        init_process = psutil.Process(1)
        all_processes = [init_process] + init_process.children(recursive=True)

        try:
              rss = sum([p.memory_info().rss for p in all_processes])
              cpu = sum([p.cpu_percent() for p in all_processes])
              time.sleep(0.1)
              cpu = sum([p.cpu_percent() for p in all_processes])
        except psutil.NoSuchProcess:
              pass

        cpu_message=('%.2f%%' % cpu)

        broadcast_message=''
        try:
             with open('/tmp/broadcast.message', 'r') as broadcast:
                broadcast_message=broadcast.read()
        except FileNotFoundError:
             pass

        limits = {}

        if config.mem_limit != 0:
            limits['memory'] = {
                'rss': config.mem_limit
            }
            if config.mem_warning_threshold != 0:
                limits['memory']['warn'] = (config.mem_limit - rss) < (config.mem_limit * config.mem_warning_threshold)

        gpu_message=''
        try:
           for g in GPUtil.getGPUs():
              gpu_message += ( 'GPU %d (%s): %.2f%% active ; %dMB/%dMB GRAM' % (g.id, g.name, g.load*100, g.memoryUsed, g.memoryTotal) )
        except ValueError:
           gpu_message = 'n/a'
           pass

        metrics = {
            'rss': rss,
            'limits': limits,
            'gpu': gpu_message,
            'cpu': cpu_message,
            'broadcast': broadcast_message
        }
        self.write(json.dumps(metrics))


def _jupyter_server_extension_paths():
    """
    Set up the server extension for collecting metrics
    """
    return [{
        'module': 'nbresuse',
    }]

def _jupyter_nbextension_paths():
    """
    Set up the notebook extension for displaying metrics
    """
    return [{
        "section": "notebook",
        "dest": "nbresuse",
        "src": "static",
        "require": "nbresuse/main"
    }]

class ResourceUseDisplay(Configurable):
    """
    Holds server-side configuration for nbresuse
    """

    mem_warning_threshold = Float(
        0.1,
        help="""
        Warn user with flashing lights when memory usage is within this fraction
        memory limit.

        For example, if memory limit is 128MB, `mem_warning_threshold` is 0.1,
        we will start warning the user when they use (128 - (128 * 0.1)) MB.

        Set to 0 to disable warning.
        """,
        config=True
    )

    mem_limit = Int(
        0,
        config=True,
        help="""
        Memory limit to display to the user, in bytes.

        Note that this does not actually limit the user's memory usage!

        Defaults to reading from the `MEM_LIMIT` environment variable. If
        set to 0, no memory limit is displayed.
        """
    )

    @default('mem_limit')
    def _mem_limit_default(self):
        return int(os.environ.get('MEM_LIMIT', 0))

def load_jupyter_server_extension(nbapp):
    """
    Called during notebook start
    """
    resuseconfig = ResourceUseDisplay(parent=nbapp)
    nbapp.web_app.settings['nbresuse_display_config'] = resuseconfig
    route_pattern = url_path_join(nbapp.web_app.settings['base_url'], '/metrics')
    nbapp.web_app.add_handlers('.*', [(route_pattern, MetricsHandler)])
