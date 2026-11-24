# valance1.github.io

Portfólio de animação 3D. Site estático (HTML + CSS + JS puro) no GitHub Pages.
Todo o conteúdo vem de arquivos `.txt`: para atualizar o site você só edita texto.

## Páginas

| Arquivo | O que mostra |
|---|---|
| `index.html` | Banner, lista de projetos (`>MY WORK<`) e "In production" |
| `project.html?p=NomeDaPasta` | Página de um projeto (vídeo, descrição, créditos, galeria) |
| `about.html` | Resumo, software, habilidades e experiência |

Os antigos `Projects/<Nome>/<Nome>.html` agora só redirecionam para `project.html?p=<Nome>`, então links antigos continuam funcionando.

## Adicionar um projeto

1. Copie `Resources/Example Project` para `Projects/MeuProjeto` (sem espaços no nome).
2. Edite os três arquivos dentro dela:
   - `description.txt`: título, descrição, software (separado por vírgula) e thumbnail opcional, separados por linhas `---`. Sem thumbnail, o site usa a do vídeo do YouTube.
   - `media.txt`: uma mídia por linha. O primeiro vídeo vira o player grande; o resto aparece na galeria horizontal embaixo. Aceita YouTube, imagens, comparação antes/depois, .mp4, Sketchfab e modelos 3D `.glb` (exportados do Blender), que viram um visualizador girável. Veja os comentários no arquivo de exemplo.
   - `stats.txt`: créditos (`Year`, `Client`, `Role`, `Collaborators`). Linha sem valor não aparece. `Year` e `Client` também aparecem no card da página inicial.
3. Adicione `MeuProjeto` em `Config/projects.txt`. A ordem desse arquivo é a ordem da grade e do botão próximo/anterior.

## Outras configurações

- `Config/userinformation.txt`: foto, nome, funções (separadas por `|`), local e links sociais (um por linha). Um e-mail numa linha própria vira o botão "copiar e-mail" da chamada de contato.
- `Config/inproduction.txt`: projetos em andamento, `Título | nota`. Vazio = seção escondida.
- `Config/summary.txt`, `software.txt`, `skills.txt`, `productions.txt`: página About.
- Banner da home: termine uma linha de imagem em qualquer `media.txt` com `*`. Sem isso, usa a thumbnail do primeiro projeto.
- Cores: no topo de `CSS/site.css` (`--spot` é a cor de destaque).
- Animações: `JS/motion.js` (GSAP + ScrollTrigger + Lenis). Quem tem "reduzir movimento" ativado no sistema vê o site sem animação.

## Testar no computador

Os arquivos são carregados com `fetch`, então abrir o HTML com duplo clique não funciona. Rode um servidor na pasta:

```
python -m http.server
```

e abra http://localhost:8000.
