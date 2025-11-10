---
title: Plate
slug: plate-1762791415001
source: https://next.platejs.org/docs/controlled
captured_at: 2025-11-10T16:16:55.001Z
---

Docs

Controlled Editor Value

# Controlled Editor Value

How to control the editor value.

Implementing a fully controlled editor value in Plate (and Slate) is complex due to several factors:

1.  The editor state includes more than just the content (`editor.children`). It also includes `editor.selection` and `editor.history`.
    
2.  Directly replacing `editor.children` can break the selection and history, leading to unexpected behavior or crashes.
    
3.  All changes to the editor's value should ideally happen through [Transforms](https://docs.slatejs.org/api/transforms) to maintain consistency with selection and history.
    

Given these challenges, it's generally recommended to use Plate as an uncontrolled input. However, if you need to make external changes to the editor's content, you can use `editor.tf.setValue(value)` function.

Using `editor.tf.setValue` will re-render all nodes on each call, so it should be used carefully and sparingly. It may impact performance if used frequently or with large documents.

Alternatively, you can use `editor.tf.reset()` to reset the editor state, which will reset the selection and history.

```
function App() {
  const editor = usePlateEditor({
    value: 'Initial Value',
    // Disable the editor if initial value is not yet ready
    // enabled: !!value,
  });
 
  return (
    <div>
      <Plate editor={editor}>
        <PlateContent />
      </Plate>
 
      <button
        onClick={() => {
          // Replace with HTML string
          editor.tf.setValue('Replaced Value');
 
          // Replace with JSON value
          editor.tf.setValue([
            {
              type: 'p',
              children: [{ text: 'Replaced Value' }],
            },
          ]);
 
          // Replace with empty value
          editor.tf.setValue();
        }}
      >
        Replace Value
      </button>
      
      <button
        onClick={() => {
          editor.tf.reset();
        }}
      >
        Reset Editor
      </button>
    </div>
  );
}
```

Copy

PreviewCode

Initial Value

Replace ValueReset Editor

[Editor Methods](https://next.platejs.org/docs/editor-methods)[HTML](https://next.platejs.org/docs/html)
