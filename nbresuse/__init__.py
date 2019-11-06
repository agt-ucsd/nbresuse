import os
import os.path
import json
import signal
import psutil
import GPUtil
from traitlets import Float, Int, default
from traitlets.config import Configurable
from notebook.utils import url_path_join
from notebook.base.handlers import IPythonHandler
from tornado import web


def sigterm_handler(signal, frame):
    pass

def get_mem(config):
    try:
        # related to memory usage
        cur_process = psutil.Process()
        all_processes = [cur_process] + cur_process.children(recursive=True)
        rss = sum([p.memory_info().rss for p in all_processes])

        limits = {}

        if config.mem_limit != 0:
            limits['memory'] = {
                'rss': config.mem_limit
            }
            if config.mem_warning_threshold != 0:
                limits['memory']['warn'] = (config.mem_limit - rss) < (config.mem_limit * config.mem_warning_threshold)

        metrics = {
            'rss': rss,
            'limits': limits
        }

        return metrics

    except Exception as e:
        metrics = {
            'rss': None,
            'limits': None
        }

def get_gpu():
    try:
        gpus = GPUtil.getGPUs()
        
        if not len(gpus) == 0:
            loads = []
            for gpu in gpus:
                loads.append(gpu.load)
            
            total_load = round(sum(loads) * 100, 2)
        
        return {'gpu': total_load}
    except Exception as e:
        return {'gpu': 'n/a'}

def is_pod_terminating():
    try:
        fp = os.path.join('/tmp', 'termination.txt')
        is_terminating = os.path.exists(fp)

        time_to_termination = 0
        if is_terminating:
            with open(fp, 'r') as f:
                time_to_termination = int(f.read())

        return {'termination': time_to_termination}

    except Exception as e:
        return {'termination': 0}

def get_cpus():
    try:
        cpus = psutil.cpu_count()
        return {'cpu_count': cpus}
    except Exception as e:
        return {}

def get_cpu_percent():
    try:
        current_process = psutil.Process()
        all_processes = [current_process] + current_process.children(recursive=True)
        cpu_percent_usage = list(map(lambda p: p.cpu_percent(interval=0.05), all_processes))

        return {'cpu_percent_usage': sum(cpu_percent_usage)}

    except Exception as e:
        return {}

def get_metrics(config):
    try:
        mem_usage = get_mem(config)
        gpu_usage = get_gpu()
        termination = is_pod_terminating()
        cpu_percent = get_cpu_percent()
        cpu_count = get_cpus()

        metrics = dict()
        metrics.update(mem_usage)
        metrics.update(gpu_usage)
        metrics.update(termination)
        metrics.update(cpu_percent)
        metrics.update(cpu_count)

        return metrics

    except Exception as e:
        # FIXME this should throw an error. The ipython handler should
        # do something else
        return {
            'rss': None,
            'limits': None,
            'gpu': 'uncaught',
            'termination': 0
        }

class MetricsHandler(IPythonHandler):
    @web.authenticated
    def get(self):
        """
        Calculate and return current resource usage metrics
        """
        config = self.settings['nbresuse_display_config']
        
        metrics = get_metrics(config)
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
    return [
        {
            "section": "notebook",
            "dest": "nbresuse",
            "src": "static",
            "require": "nbresuse/main"
        }
    ]

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
    signal.signal(signal.SIGTERM, sigterm_handler)
    resuseconfig = ResourceUseDisplay(parent=nbapp)
    nbapp.web_app.settings['nbresuse_display_config'] = resuseconfig
    route_pattern = url_path_join(nbapp.web_app.settings['base_url'], '/nbresuse/metrics')
    nbapp.web_app.add_handlers('.*', [(route_pattern, MetricsHandler)])
