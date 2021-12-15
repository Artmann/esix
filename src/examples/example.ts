export type Example = {
  code: () => Promise<any>;
  dataset: Record<string, any[]>;
  output: any;
  name: string;
  text: string;
};
