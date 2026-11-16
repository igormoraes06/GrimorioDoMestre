## Grimório do Mestre

Site para mestres de RPG pesquisarem monstros e magias de D&D 5e, salvarem seus favoritos em um grimório pessoal (com notas e tags)
e registrarem os acontecimentos na mesa.

O site foi idealizado e construído pelos estudantes de Licenciatura da Computação, Igor Duarte e Bruno Familiar,
na sede do Instituto Federal de Ciências e Tecnologias do Rio de Janeiro - IFRJ, campus pinheiral, durante
as aulas ministradas pelo professor Alex Moreira Fonseca, na disciplina de WEB II, em 2026-2.

## O que foi usado para construção do site (como requisito parcial para obtenção de nota da disciplina): 

- HTML, CSS e JavaScript puro sem frameworks;
- API: D&D 5e API (https://www.dnd5eapi.co/api);
- Banco de dados: Firebase Cloud Firestore (para 'grimorio' e 'encontros').

## Funcionalidades:

- Javascript (Buscar): pesquisa monstros ou magias por nome, com indicador de carregamento e tratamento de erros;
- Firebase Cloud Firestore (Meu grimório e Encontros): salvar com nota e tags, listar, editar nota/tags e excluir. Filtros por nome, tipo, CR e tag.

## Como usar nosso Grimório do Mestre:

1. Na aba inicial Buscar, você pesquisa por monstros e magias a fim de encontrar o feitiço ou criatura desejada;
1.1. Para isso, é necessário que você busque pela categoria do monstro/magia em inglês
(⚠ Não se preocupe quanto a este fator, após concluir a busca, você irá encontrar o que deseja traduzido para PT-BR.
A razão quanto a este problema é que a API usada para encontrar uma grande listagem de monstros e poderes não possui uma
tradução direta. Entretanto, nosso HTML se esforça para entregá-lo uma tradução livre);

2. Após encontrar o que deseja, clique em Ver e salvar, escreva uma nota, adicione tags separadas por vírgula (⚠ Opcional) e salve;

3. Na aba Meu grimório, filtre, edite ou exclua seus favoritos;

4. Em Encontros, crie possíveis confrontos, marque os monstros e salve o encontro.

5. Em anotações, marque no calendário os dias em que ocorreram e/ou ocorrerão as sessões, e escreva sobre elas.

## ⚠ Observação ⚠

As regras do Firestore em modo de teste deixam o banco aberto por tempo limitado.
