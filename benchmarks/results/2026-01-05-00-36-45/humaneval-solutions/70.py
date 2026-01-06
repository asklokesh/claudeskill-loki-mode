
def strange_sort_list(lst):
    '''
    Given list of integers, return list in strange order.
    Strange sorting, is when you start with the minimum value,
    then maximum of the remaining integers, then minimum and so on.

    Examples:
    strange_sort_list([1, 2, 3, 4]) == [1, 4, 2, 3]
    strange_sort_list([5, 5, 5, 5]) == [5, 5, 5, 5]
    strange_sort_list([]) == []
    '''
result = []
    sorted_lst = sorted(lst)
    left = 0
    right = len(sorted_lst) - 1
    take_min = True
    
    while left <= right:
        if take_min:
            result.append(sorted_lst[left])
            left += 1
        else:
            result.append(sorted_lst[right])
            right -= 1
        take_min = not take_min
    
    return result