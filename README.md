这是 [hugo-theme-stack-starter](https://github.com/CaiJimmy/hugo-theme-stack-starter/) 的一个非官方改版，正在持续加入功能！

当前修改版已经加入的功能有：

- 深浅模式切换文字提示；

- 更详细的文章信息；

- 自建镜像源 $\LaTeX$；

- 文章加密。

其中文章加密功能在构建时进行。建议使用 Private 仓库。

对于本地测试加密功能：

```npm install && npm run preview``` 

对于部署命令：

```npm install && npm run build```

启用方法：

在文章 Frontmatter 指定以下：

```
password: "你的密码"
passwordHint: "你的密码提示（可选）"
```