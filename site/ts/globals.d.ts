declare var ShellJS: any;
declare var playFreeBSDBoot: any;
declare var playFreeBSDShutdown: any;

interface Window {
  echarts: any;
  MathJax: any;
  notesMath: (root?: ParentNode | Element) => Promise<void>;
  markFreeBSDReboot: () => void;
  mermaid: any;
  mermaidConfig: any;
  playFreeBSDBoot: any;
  playFreeBSDShutdown: any;
}
